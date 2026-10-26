/** What an account can earn from ads in a day: the cap times the reward, only when both are whole numbers above 0. */
export function dailyMax(cap: unknown, reward: unknown): number | null {
  const whole = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;
  return whole(cap) && whole(reward) ? cap * reward : null;
}
