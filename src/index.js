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
     * Function used to add a new block.
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
      difficulty: opts.difficulty || DIFFICULTY,
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
  return this._.chain.find((blockInst) => {
    return blockInst.valid === false
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
 * Function used to queue data to be added in the blockchain.
 * @this {module:blockchain}
 * @param {opts} opts      Options for addBlock function.
 * @param {*}    opts.data Block data.
 */
function enqueueData (opts) {
  const queuedDataInst = queuedData(opts)
  this._.queue.push(queuedDataInst)
  this.emit('enqueue-data', queuedDataInst)
  constructNextBlock.call(this)
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
  this._.block = block({
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
  this._.block.on('aborted', () => {
    // Re-include the Queued Data object in the queue, since it wasn't added in
    // the Blockchain.
    this._.queue.unshift(queuedDataInst)
    // Reset attribute storing the current Block being initialized.
    this._.block = null
  })

  // Listen for the Block's ready event (which will mean that the Block has
  // been constructed).
  this._.block.on('ready', () => {
    // Include newly created block in Blockchain.
    this._.chain.push(this._.block)
    // Notify Event Emitter listeners that a new Block has been added in the
    // Blockchain.
    this.emit('new-block', this._.block, queuedDataInst.id)
    // Reset attribute storing the current Block being initialized.
    this._.block = null
    // Start working on constructing the next Block.
    constructNextBlock.call(this)
  })
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
