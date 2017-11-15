'use strict'

const assert = require('assert')
const crypto = require('crypto')
const constants = require('./constants')

process.on('message', (encodedPayload) => {
  // Parse the encoded payload into an object.
  const payload = parseJSON(Buffer.from(encodedPayload, 'base64')
    .toString('ascii'))

  // Check for required fields.
  assert.notEqual(payload.signiture, null)

  // Use Default Proof of Work difficulty, if one is not specified.
  payload.difficulty = (payload.difficulty == null) ? constants.DIFFICULTY
    : payload.difficulty

  /**
   * Used to alter the Block's hash without affecting the Block's data to find a
   * hash less than the specified Proof of Work difficulty.
   * @type {number}
   */
  let nonce = -1

  // Loop until a hash less than the Proof of Work difficulty is found.
  while (true) {
    // Create SHA256 Hash object.
    var sha256 = crypto.createHash('sha256')

    // Append the nonce to the Block's singiture.
    sha256.update(payload.signiture + String(++nonce))

    // Generate Block's hash.
    var hash = sha256.digest('hex')

    // Try another nonce, if the Block's hash is still bigger than the specified
    // Proof of Work difficulty.
    if (global.parseInt(hash, 16) > payload.difficulty) continue

    // Stop process and send the hash & nonce, to the parent NodeJS process when
    // a hash less than the specified Proof of Work difficulty is found.
    process.send(JSON.stringify({ hash, nonce }))
    return
  }
})

/**
 * Function used to parse a string into an object.
 * @param  {string} str String to be parsed into an object
 * @return {Object}     Object which the specified string represents, if it is
 *                      parsable.
 * @return {Object}     Empty object, if the specified string is not parsable.
 */
function parseJSON (str) {
  try {
    return JSON.parse(str)
  } catch () {
    return {}
  }
}
