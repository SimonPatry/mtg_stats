import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MIN_SEATS, MAX_SEATS, DEFAULT_SEATS, isValidSeatCount, makeSeatRange, renumberSeats } from '../src/seats.js'

test('les bornes de table sont 2 à 5, 4 par défaut', () => {
  assert.equal(MIN_SEATS, 2)
  assert.equal(MAX_SEATS, 5)
  assert.equal(DEFAULT_SEATS, 4)
})

test('isValidSeatCount refuse hors bornes et non entiers', () => {
  assert.equal(isValidSeatCount(2), true)
  assert.equal(isValidSeatCount(5), true)
  assert.equal(isValidSeatCount(1), false)
  assert.equal(isValidSeatCount(6), false)
  assert.equal(isValidSeatCount(3.5), false)
  // Coercition volontaire : la valeur vient d'un <input>, donc d'une chaîne.
  assert.equal(isValidSeatCount('4'), true)
  assert.equal(isValidSeatCount(null), false)
  assert.equal(isValidSeatCount(undefined), false)
})

test('makeSeatRange produit 1..n', () => {
  assert.deepEqual(makeSeatRange(4), [1, 2, 3, 4])
  assert.deepEqual(makeSeatRange(2), [1, 2])
})

test('renumberSeats renumérote en partant de 1 sans trou', () => {
  const out = renumberSeats([{ seatOrder: 7 }, { seatOrder: 2 }, { seatOrder: 9 }])
  assert.deepEqual(out.map((x) => x.seatOrder), [1, 2, 3])
})
