const DAY_LENGTH_SECONDS = 180
let cycleSeconds = 0

export function advanceDayNight(dt: number, enabled: boolean) {
  if (enabled) cycleSeconds += dt
  return cycleSeconds
}

export function getDayNightSeconds() {
  return cycleSeconds
}

export function sunElevation(elapsedSeconds: number) {
  return Math.sin((elapsedSeconds / DAY_LENGTH_SECONDS) * Math.PI * 2 + Math.PI / 2)
}

export function daylightAmount(elapsedSeconds: number) {
  const elevation = sunElevation(elapsedSeconds)
  const t = Math.max(0, Math.min(1, (elevation + 0.12) / 0.42))
  return t * t * (3 - 2 * t)
}
