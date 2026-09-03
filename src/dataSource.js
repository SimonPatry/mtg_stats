export const DATA_SOURCE_KEY = 'mtg_stats_data_source'
export const DATA_SOURCE = {
  REAL: 'real',
  FAKE: 'fake',
}

export function loadDataSource() {
  try {
    const raw = sessionStorage.getItem(DATA_SOURCE_KEY)
    return raw === DATA_SOURCE.FAKE ? DATA_SOURCE.FAKE : DATA_SOURCE.REAL
  } catch {
    return DATA_SOURCE.REAL
  }
}

export function saveDataSource(source) {
  try {
    sessionStorage.setItem(
      DATA_SOURCE_KEY,
      source === DATA_SOURCE.FAKE ? DATA_SOURCE.FAKE : DATA_SOURCE.REAL,
    )
  } catch {
    /* ignore */
  }
}

export function sourceQuery(source) {
  return source === DATA_SOURCE.FAKE ? '?source=fake' : ''
}
