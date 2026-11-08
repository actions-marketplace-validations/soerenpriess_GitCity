export function calculateStreaks(
  commitsByDay: Record<string, number>,
  today = new Date(),
): {
  current: number;
  longest: number;
} {
  const days = Object.keys(commitsByDay)
    .filter((day) => commitsByDay[day]! > 0)
    .sort();
  if (days.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let index = 1; index < days.length; index += 1) {
    const previous = new Date(`${days[index - 1]}T00:00:00Z`).getTime();
    const current = new Date(`${days[index]}T00:00:00Z`).getTime();
    if (current - previous === 86_400_000) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  const todayKey = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);
  const latest = days[days.length - 1]!;
  let current = 0;
  if (latest === todayKey || latest === yesterdayKey) {
    current = 1;
    for (let index = days.length - 1; index > 0; index -= 1) {
      const currentDay = new Date(`${days[index]}T00:00:00Z`).getTime();
      const priorDay = new Date(`${days[index - 1]}T00:00:00Z`).getTime();
      if (currentDay - priorDay !== 86_400_000) break;
      current += 1;
    }
  }
  return { current, longest };
}
