'use strict'

const assert = require('assert')
const crypto = require('crypto')
const EventEmitter = require('events')

/**
 * Function used to create a new Block.
 * @param  {Object} opts              Options for createBlock function.
 * @param  {*}      opts.data         Data to be stored in the Block.
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
     * Data to be stored in the Block
     * @type {Object}
     */
    data: opts.data,

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
     * Block's creation date.
     * @type {number}
     */
    date: opts.date || Date.now(),

    /**
     * Function used to validate the Block.
     */
    validate
  })

  // Generate Block's hash, if it is not already specified.
  generateHash.call(block)

  // Return new block instance.
  return block
}

/**
 * Function used to validate the Block
 * @this {module:block}
 * @return {boolean} TRUE if valid.
 * @return {boolean} FALSE if not valid.
 */
function validate () {
  // Signiture of Hash without the nonce.
  const signiture = String(this.index) + String(this.difficulty) +
    String(this.previousHash) + String(this.data) + String(this.date) +
    String(this.nonce)

  var sha256 = crypto.createHash('sha256')
  sha256.update(signiture)
  var hash = sha256.digest('hex')
  return hash === this.hash && parseInt(hash, 16) <= this.difficulty
}

/**
 * Function used generate the Block hash.
 * @async
 * @this {module:block}
 * @return {Promise} Resolved once the Block hash has been generated.
 */
function generateHash () {
  if (this.hash !== null) return
  process.nextTick(() => {
    // Signiture of Hash without the nonce.
    const signiture = String(this.index) + String(this.difficulty) +
      String(this.previousHash) + String(this.data) + String(this.date)

    // Search for a Block hash that is smaller than the difficulty of the
    // proof of work.
    while (true) {
      var sha256 = crypto.createHash('sha256')
      sha256.update(signiture + String(++this.nonce))
      var hash = sha256.digest('hex')
      if (parseInt(hash, 16) > this.difficulty) continue
      this.hash = hash
      this.emit('ready', hash)
      return
    }
  })
}
