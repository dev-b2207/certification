
// timeFunction.ts
import { TimeCondition } from "../interfaces";

// function addOneSecond(time: string): string {
//   const [h, m, s] = time.split(":").map(Number);
//   const date = new Date(1970, 0, 1, h, m, s || 0);
//   date.setSeconds(date.getSeconds() + 1);
//   return date.toTimeString().slice(0, 8); // "HH:MM:SS"
// }

export function calculateTimeRange(
  condition: TimeCondition,
  fromTime: string,
  toTime: string
) {
  let startTime: string | null = null;
  let endTime: string | null = null;

  switch (condition) {
    case "Is":
      // exact match, use fromTime
      startTime = fromTime;
      endTime = fromTime;
      break;

    case "Is not":
      // all times except fromTime, represent as full day
      startTime = fromTime;
      endTime = fromTime;
      break;

    case "Is greater than":
      // all times strictly after fromTime
      startTime = fromTime;
      endTime = "23:59:59";
      break;

    case "Is less than":
      // all times strictly before toTime
      startTime = "00:00:00";
      endTime = toTime;
      break;

    case "Is between":
      // all times between fromTime and toTime
      startTime = fromTime;
      endTime = toTime;
      break;

    case "Is empty":
      // no time selected
      startTime = null;
      endTime = null;
      break;

    case "Is not empty":
      // full day
      startTime = "00:00:00";
      endTime = "23:59:59";
      break;

    default:
      startTime = null;
      endTime = null;
      break;
  }

  return startTime && endTime ? { startTime, endTime } : null;
}


