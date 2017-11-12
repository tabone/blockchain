'use strict'

const EventEmitter = require('events')
const block = require('./block')
const queuedData = require('./queued-data')

/**
 * Default proof of work difficulty.
 * @type {number}
 */
const DIFFICULTY = 1766847064778384329583297500742918515827483896875618958121606201292619775

/**
 * Function used to create a new Blockchain.
 * @param  {Object} opts              Options for createBlockchain function.
 * @param  {number} [opts.difficulty] Proof of work difficulty.
 * @return {module:blockchain} Blockchain object.
 */
module.exports = function createBlockchain (opts = {}) {
  // Create Blockchain Event Emitter object.
  const blockchain = Object.assign(new EventEmitter(), {
    /**
     * Function used to stop the Blockchain from including the current Block
     * being initialized.
     */
    abort,

    /**
     * Function used to move the next data in the queue inside the Blockchain.
     */
    resume: constructNextBlock,

    /**
     * Function used to add a new Block to the Blockchain.
     */
    addBlock,

    /**
     * Function used to queue data to be stored to the Blockchain.
     */
    enqueueData,

    /**
     * Function used to customize the string representation of an object.
     */
    toJSON,

    /**
     * Contains properties that should only be used by the Blockchain object.
     * @type {Object}
     */
    _: {
      /**
       * Blockchain.
       * @type {Array.<module:block>}
       */
      chain: [],

      /**
       * Stores data to be added in the Blockchain.
       * @type {Array.<module:queue-data>}
       */
      queue: [],

      /**
       * Block which is being added to the chain.
       * @type {module:block}
       */
      block: null,

      /**
       * Proof of work difficulty.
       * @type {number}
       */
      difficulty: opts.difficulty || DIFFICULTY
    }
  })

  // Setup getters & setters.
  Object.defineProperty(blockchain, 'chain', { get: getChain })
  Object.defineProperty(blockchain, 'valid', { get: getValid })
  Object.defineProperty(blockchain, 'nextIndex', { get: getNextIndex })
  Object.defineProperty(blockchain, 'latestBlock', { get: getLatestBlock })
  Object.defineProperty(blockchain, 'genesisBlock', { get: getGenesisBlock })
  Object.defineProperty(blockchain, 'difficulty', {
    get: getDifficulty, set: setDifficulty
  })

  // Return a new Blockchain instance.
  return blockchain
}

/**
 * Function used to return a copy of the Blockchain.
 * @this {module:blockchain}
 * @return {number} Blockchain.
 */
function getChain () {
  return this._.chain.slice(0)
}

/**
 * Function used to validate the Blockchain.
 * @this {module:blockchain}
 * @return {boolean} TRUE if valid.
 * @return {boolean} FALSE if not valid.
 */
function getValid () {
  return this._.chain.find((blockInst, index) => {
    // Retreive the expected Block's previous hash.
    const previousHash = (index === 0) ? '' : this._.chain[index - 1].hash

    // Validate Block.
    return validateBlock(blockInst, index, previousHash) === false
  }) === undefined
}

/**
 * Function used to return the next available block index.
 * @this {module:blockchain}
 * @return {number} Next available index.
 */
function getNextIndex () {
  return this._.chain.length
}

/**
 * Function used to return the genesis block.
 * @this {module:blockchain}
 * @return {number} Genesis block.
 */
function getGenesisBlock () {
  return this._.chain[0]
}

/**
 * Function used to return the latest added block.
 * @this {module:blockchain}
 * @return {module:block} Lastest added block.
 */
function getLatestBlock () {
  return this._.chain[this._.chain.length - 1]
}

/**
 * Function used to return the proof of work difficulty.
 * @this {module:blockchain}
 * @return {number} Proof of work difficulty.
 */
function getDifficulty () {
  return this._.difficulty
}

/**
 * Function used to set the Blockchain proof of work difficulty.
 * @this {module:blockchain}
 * @param {number} difficulty Proof of work difficulty.
 */
function setDifficulty (difficulty) {
  if (typeof difficulty !== 'number') {
    throw new Error('proof of work difficulty should be a number')
  }

  this._.difficulty = difficulty
}

/**
 * Function used to stop the Blockchain from including the current Block
 * being initialized.
 * @this {module:blockchain}
 */
function abort () {
  // Abort current Block initialization, if there is one ongoing.
  if (this._.block !== null) this._.block.abort()
}

/**
 * Function used to add a new Block to the Blockchain.
 * @this {module:blockchain}
 * @param {Object} blockInfo    Block to be added.
 * @param {string} queuedDataID ID of Queued Data that the specified Block was
 *                              created for.
 * @return {boolean} TRUE if the Block has been added to the Blockchain.
 * @return {boolean} FALSE if the Block hasn't been added to the Blockchain.
 */
function addBlock (blockInfo, queuedDataID) {
  // Create Block object.
  const blockInst = block(blockInfo)

  // Retrieve the hash of the latest Block in the Blockchain.
  const latestHash = (this.nextIndex === 0) ? '' : this.latestBlock.hash

  // Stop process & return false, if Block is invalid.
  if (validateBlock(blockInst, this.nextIndex, latestHash) === false) {
    return false
  }

  // Abort any Block initialization.
  this.abort()

  // Include the new Block in the Blockchain.
  this._.chain.push(blockInst)

  // Remove the Queued Data which the specified Block was created for.
  removeQueuedData.call(this, queuedDataID)

  // Notify Event Emitter listeners that a new Block has been added in the
  // Blockchain.
  this.emit('new-block', blockInst, queuedDataID)

  // Construct the next Block.
  this.resume()

  // Return true to indicate that the specified Block was added to the
  // Blockchain.
  return true
}

/**
 * Function used to queue data to be added in the blockchain.
 * @this {module:blockchain}
 * @param {opts} opts      Options for addBlock function.
 * @param {*}    opts.data Block data.
 */
function enqueueData (opts) {
  const queuedDataInst = queuedData(opts)
  this._.queue.push(queuedDataInst)
  this.emit('enqueue-data', queuedDataInst)
  this.resume()
}

/**
 * Function used to move the next data in the queue to the Blockchain.
 * @this {module:blockchain}
 */
function constructNextBlock () {
  // Stop process, if the Blockchain object is already working on including a
  // Block.
  if (this._.block !== null) return

  // Stop process, if there is no data in the queue.
  if (this._.queue.length === 0) return this.emit('waiting')

  // Retrieve the Queued Data object to be inserted in a Block.
  const queuedDataInst = this._.queue.shift()

  // Create block.
  const blockInst = this._.block = block({
    data: queuedDataInst.data,
    index: this.nextIndex,
    difficulty: this._.difficulty,
    previousHash: (this.nextIndex === 0) ? '' : this.latestBlock.hash
  })

  // Notify Event Emitter listener that the Blockchain will be constructing a
  // new block.
  this.emit('constructing-block', queuedDataInst)

  // Listen for the Block's aborted event (which will mean that the Block
  // initialization has been aborted).
  blockInst.on('aborted', () => {
    // Reset attribute storing the current Block being initialized.
    this._.block = null
    // Re-include the Queued Data object in the queue, since it wasn't added in
    // the Blockchain.
    this._.queue.unshift(queuedDataInst)
  })

  // Listen for the Block's ready event (which will mean that the Block has
  // been constructed).
  blockInst.on('ready', () => {
    // Reset attribute storing the current Block being initialized.
    this._.block = null
    // Include newly created block in Blockchain.
    this._.chain.push(blockInst)
    // Notify Event Emitter listeners that a new Block has been added in the
    // Blockchain.
    this.emit('new-block', blockInst, queuedDataInst.id)
    // Start working on constructing the next Block.
    this.resume()
  })
}

/**
 * Function used to remove a Queued Data from the queue using its ID.
 * @this {module:blockchain}
 * @param  {string} queuedDataID Queued Data ID to be removed.
 */
function removeQueuedData (queuedDataID) {
  // Retreive the position of the Queued Data to be removed.
  const pos = this._.queue.findIndex((queuedDataInst) => {
    return queuedDataInst.id === queuedDataID
  })

  // Remove Queued Data, if it exist in the queue.
  if (pos !== -1) this._.queue.splice(pos, 1)
}

/**
 * Function used to validate a Block in the Blockchain.
 * @param  {module:block} blockInst    Block to be validated.
 * @param  {number}       index        Expected position of the Block in the
 *                                     Blockchain.
 * @param  {string}       previousHash Expected previous hash.
 * @return {boolean}      TRUE if Block is valid.
 * @return {boolean}      FALSE if Block is invalid.
 */
function validateBlock (blockInst, index, previousHash) {
  // Stop process & return false, if Block's hash is invalid.
  if (blockInst.valid === false) return false

  // Stop process & return false, if Block's index does not match the Block's
  // position in the Blockchain.
  if (blockInst.index !== index) return false

  // Stop process & return false, if Block's previous hash is invalid.
  if (blockInst.previousHash !== previousHash) return false

  // Return true to indicate that the Block is valid.
  return true
}

/**
 * Function used to customize the string representation of an object.
 * @this {module:blockchain}
 * @return {Object} Object that should be stringified.
 */
function toJSON () {
  return {
    valid: this.valid,
    chain: this._.chain,
    queue: this._.queue,
    difficulty: this._.difficulty
  }
}
