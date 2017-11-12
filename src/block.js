'use strict'

const assert = require('assert')
const crypto = require('crypto')
const EventEmitter = require('events')
const states = require('./block-states')
const queuedData = require('./queued-data')

/**
 * Function used to create a new Block.
 * @param  {Object} opts              Options for createBlock function.
 * @param  {Object} opts.data         Data to be stored in the Block.
 * @param  {number} opts.index        Position of the Block in the Blockchain.
 * @param  {number} opts.difficulty   Proof of work difficulty.
 * @param  {string} opts.previousHash Hash of previous Block.
 * @param  {number} [opts.nonce=-1]   Used to alter the Block's signiture
 *                                    without affecting the Block's data, so
 *                                    that the signiture would be less than the
 *                                    Proof of Work difficulty, thus resulting
 *                                    in a signiture with a number of leading
 *                                    zeros.
 * @param  {number} [opts.hash]       Block's hash.
 * @param  {number} [opts.date]       Block's creation date.
 * @return {module:block}             Block to be added in the Blockchain.
 */
module.exports = function createBlock (opts) {
  // Check for required fields.
  assert.notEqual(opts.data, null)
  assert.notEqual(opts.index, null)
  assert.notEqual(opts.difficulty, null)
  assert.notEqual(opts.previousHash, null)

  // Create Block Event Emitter object.
  const block = Object.assign(Object.create(new EventEmitter()), {
    /**
     * Function used to abort the Block initialization.
     */
    abort,

    /**
     * Function used to customize the string representation of an object.
     */
    toJSON,

    /**
     * Contains properties that should only be used by the Block object.
     * @type {Object}
     */
    _: {
      /**
       * Data to stored in the Block.
       * @type {module:queued-data}
       */
      data: queuedData(opts.data),

      /**
       * Position of the Block in the Blockchain.
       * @type {number}
       */
      index: opts.index,

      /**
       * Proof of work difficulty.
       * @type {number}
       */
      difficulty: opts.difficulty,

      /**
       * Hash of previous Block.
       * @type {string}
       */
      previousHash: opts.previousHash,

      /**
       * Used to alter the Block's hash without affecting the Block's data, so
       * that the hash would be less than the Proof of Work difficulty, thus
       * resulting in a hash with a number of leading zeros.
       * @type {number}
       */
      nonce: opts.nonce || -1,

      /**
       * Block's hash.
       * @type {string}
       */
      hash: opts.hash || null,

      /**
       * Block's creation time.
       * @type {number}
       */
      date: opts.date || Date.now(),

      /**
       * Indicates the current state of the Block.
       * @type {number}
       */
      state: states.INITIALIZING
    }
  })

  // Setup getters.
  Object.defineProperty(block, 'data', { get: getData })
  Object.defineProperty(block, 'hash', { get: getHash })
  Object.defineProperty(block, 'date', { get: getDate })
  Object.defineProperty(block, 'index', { get: getIndex })
  Object.defineProperty(block, 'nonce', { get: getNonce })
  Object.defineProperty(block, 'valid', { get: getValid })
  Object.defineProperty(block, 'state', { get: getState })
  Object.defineProperty(block, 'difficulty', { get: getDifficulty })
  Object.defineProperty(block, 'previousHash', { get: getPreviousHash })

  // Generate Block's hash, if it is not already specified.
  generateHash.call(block)

  // Return new block instance.
  return block
}

/**
 * Function used to return the data stored in the Block.
 * @this {module:block}
 * @return {module:queued-data} Block's data.
 */
function getData () {
  return this._.data
}

/**
 * Function used to return the Block's hash.
 * @this {module:block}
 * @return {string} Block's hash.
 */
function getHash () {
  return this._.hash
}

/**
 * Function used to return the Block's creation time.
 * @this {module:block}
 * @return {number} Block's creation time.
 */
function getDate () {
  return this._.date
}

/**
 * Function used to return the position of the Block in the Blockchain.
 * @this {module:block}
 * @return {number} Position of the Block in the Blockchain.
 */
function getIndex () {
  return this._.index
}

/**
 * Function used to return the nonce of the Block.
 * @this {module:block}
 * @return {number} Nonce of the Block.
 */
function getNonce () {
  return this._.nonce
}

/**
 * Function used to validate the Block.
 * @this {module:block}
 * @return {boolean} TRUE if valid.
 * @return {boolean} FALSE if not valid.
 */
function getValid () {
  // Signiture of Hash without the nonce.
  const signiture = String(this._.index) + String(this._.difficulty) +
    String(this._.previousHash) + String(this._.data.id) +
    String(this._.data.data) + String(this._.date) + String(this._.nonce)

  var sha256 = crypto.createHash('sha256')
  sha256.update(signiture)
  var hash = sha256.digest('hex')
  return hash === this._.hash && parseInt(hash, 16) <= this._.difficulty
}

/**
 * Function used to return the state of the Block.
 * @this {module:block}
 * @return {number} State of the Block.
 */
function getState () {
  return this._.state
}

/**
 * Function used to return the proof of work difficulty.
 * @this {module:block}
 * @return {number} Proof of work difficulty.
 */
function getDifficulty () {
  return this._.difficulty
}

/**
 * Function used to return the hash of the previous Block.
 * @this {module:block}
 * @return {string} Hash of the Previous Block.
 */
function getPreviousHash () {
  return this._.previousHash
}

/**
 * Function used to abort the Block initialization.
 * @this {module:block}
 */
function abort () {
  // Abort initialization, if Block is still the initialization state.
  if (this._.state === states.INITIALIZING) {
    changeState.call(this, states.ABORTED)
    return
  }
  // Emit error, if Block initialization is aborted after it has been
  // initialized.
  this.emit('error', new Error('block already initialized'))
}

/**
 * Function used to change the state of the Block.
 * @this {module:block}
 * @param  {number} state New state of the Block.
 */
function changeState (state) {
  // Change the current state.
  this._.state = state

  // Notify listeners.
  switch (state) {
    case states.READY: this.emit('ready'); break
    case states.ABORTED: this.emit('aborted'); break
  }
}

/**
 * Function used generate the Block hash.
 * @async
 * @this {module:block}
 * @return {Promise} Resolved once the Block hash has been generated.
 */
function generateHash () {
  // Stop process, if the hash of the Block is already calculated.
  if (this._.hash !== null) return

  // Generate Block's hash.
  process.nextTick(() => {
    // Signiture of Hash without the nonce.
    const signiture = String(this._.index) + String(this._.difficulty) +
      String(this._.previousHash) + String(this._.data.id) +
      String(this._.data.data) + String(this._.date)

    // Search for a Block hash that is smaller than the difficulty of the
    // proof of work.
    while (true) {
      // Stop hash generation if Block is not in the initialization state.
      if (this._.state !== states.INITIALIZING) break
      var sha256 = crypto.createHash('sha256')
      sha256.update(signiture + String(++this._.nonce))
      var hash = sha256.digest('hex')
      if (parseInt(hash, 16) > this._.difficulty) continue
      this._.hash = hash
      changeState.call(this, states.READY)
    }
  })
}

/**
 * Function used to customize the string representation of an object.
 * @this {module:block}
 * @return {Object} Object that should be stringified.
 */
function toJSON () {
  return {
    valid: this.valid,
    data: this._.data,
    date: this._.date,
    hash: this._.hash,
    index: this._.index,
    nonce: this._.nonce,
    state: this._.state,
    difficulty: this._.difficulty,
    previousHash: this._.previousHash
  }
}
