'use strict'

const crypto = require('crypto')

/**
 * Function used to create a new Queued Data object. These type of objects are
 * used to store and reference data that will be stored in a Block.
 * @param  {Object} options      Options for createQueuedData function.
 * @param  {*}      options.data Data to be stored in a Block.
 * @return {module:queued-data}  Queued data object.
 */
module.exports = function createQueuedData ({ data }) {
  // Generate a random id for the Queued Data object.
  const id = crypto.randomBytes(256).toString('hex')

  // Return a new Queued Data object.
  return {
    /**
     * Returns the data of the Queued Data object.
     * @return {*} Data to be stored in a Block.
     */
    get data () {
      return data
    },

    /**
     * Returns teh id of the Queued Data object.
     * @return {string} ID of the Queued Data object.
     */
    get id () {
      return id
    }
  }
}
