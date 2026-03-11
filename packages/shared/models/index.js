// packages/shared/models/index.js
// JSDoc type definitions used across both apps for consistency.

/**
 * @typedef {Object} Salon
 * @property {string}   id
 * @property {string}   name
 * @property {string}   address
 * @property {string}   city
 * @property {string}   phone
 * @property {string[]} photos
 * @property {Hours}    hours
 * @property {Service[]} services
 * @property {Stylist[]} stylists
 * @property {number}   avgWaitMin       - Current estimated wait in minutes
 * @property {number}   queueCount       - People currently waiting
 * @property {boolean}  isOpen
 * @property {{ lat: number, lng: number }} location
 */

/**
 * @typedef {Object} Service
 * @property {string} id
 * @property {string} name          - e.g. "Haircut & Style"
 * @property {number} price         - in local currency units
 * @property {number} durationMin   - estimated duration in minutes
 * @property {string} [category]    - e.g. "Hair", "Nails", "Colour"
 */

/**
 * @typedef {Object} Stylist
 * @property {string}   id
 * @property {string}   name
 * @property {string}   [photo]
 * @property {string[]} skills       - service IDs this stylist performs
 * @property {'available'|'busy'|'break'|'off'} status
 */

/**
 * @typedef {Object} QueueEntry
 * @property {string}   id
 * @property {string}   salonId
 * @property {string|null} customerId
 * @property {string}   customerName
 * @property {Service[]} services
 * @property {string|null} stylistId
 * @property {'waiting'|'called'|'in-service'|'done'|'no-show'} status
 * @property {'online'|'walk-in'} type
 * @property {number}   position
 * @property {number}   estimatedWaitMin
 * @property {import('firebase/firestore').Timestamp} joinedAt
 * @property {import('firebase/firestore').Timestamp|null} calledAt
 * @property {import('firebase/firestore').Timestamp|null} completedAt
 */

/**
 * @typedef {Object} Customer
 * @property {string}   id
 * @property {string}   name
 * @property {string}   email
 * @property {string}   phone
 * @property {FamilyMember[]} familyMembers
 */

/**
 * @typedef {Object} FamilyMember
 * @property {string} id
 * @property {string} name
 * @property {string} [relationship]
 */

/**
 * @typedef {Object} Visit
 * @property {string}   id
 * @property {string}   salonId
 * @property {string}   stylistId
 * @property {Service[]} services
 * @property {number}   totalPrice
 * @property {import('firebase/firestore').Timestamp} completedAt
 */

/**
 * @typedef {Object} Hours
 * @property {{ open: string, close: string, closed: boolean }} mon
 * @property {{ open: string, close: string, closed: boolean }} tue
 * @property {{ open: string, close: string, closed: boolean }} wed
 * @property {{ open: string, close: string, closed: boolean }} thu
 * @property {{ open: string, close: string, closed: boolean }} fri
 * @property {{ open: string, close: string, closed: boolean }} sat
 * @property {{ open: string, close: string, closed: boolean }} sun
 */

export const STATUS_LABELS = {
  waiting:    "Waiting",
  called:     "You're being called!",
  "in-service": "In service",
  done:       "Done",
  "no-show":  "Marked as no-show",
};

export const STATUS_COLORS = {
  waiting:    "#F59E0B",
  called:     "#10B981",
  "in-service": "#3B82F6",
  done:       "#6B7280",
  "no-show":  "#EF4444",
};

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
