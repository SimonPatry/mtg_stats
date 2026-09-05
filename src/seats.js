/** Nombre de joueurs autorisé par partie (Commander). */
export const MIN_SEATS = 2
export const MAX_SEATS = 5
export const DEFAULT_SEATS = 4

export function isValidSeatCount(n) {
  const count = Number(n)
  return Number.isInteger(count) && count >= MIN_SEATS && count <= MAX_SEATS
}

export function makeSeatRange(count = DEFAULT_SEATS) {
  const n = isValidSeatCount(count) ? count : DEFAULT_SEATS
  return Array.from({ length: n }, (_, i) => i + 1)
}

export function renumberSeats(items) {
  return items.map((item, i) => ({ ...item, seatOrder: i + 1 }))
}
