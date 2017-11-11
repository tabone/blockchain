'use strict'

/**
 * Contains the possible states of a Block.
 * @type {Object}
 * @enum {number}
 * @readOnly
 */
module.exports = {
  /**
   * State when the Block is initializing.
   */
  get INITIALIZING () {
    return 0
  },

  /**
   * State when the Block is initialized.
   */
  get READY () {
    return 1
  },

  /**
   * State when the Block's initialization is aborted.
   */
  get ABORTED () {
    return 2
  }
}
