import moment from 'moment';
import { DateType, DurationType } from '../interfaces';

export function calculateRelativeDates(
  dateType: DateType,
  duration: number,
  durationType: DurationType,
  isCurrent: boolean,
  isIncluded: boolean
): { startDate: Date; endDate: Date } | null {
  const today = moment();
  const unit = durationType.toLowerCase() as moment.unitOfTime.DurationConstructor;
  const startOfUnit = durationType.toLowerCase() as moment.unitOfTime.StartOf;

  switch (dateType) {
    case 'In Last': {
      if (!duration) return null;

      if (isCurrent) {
        // Current mode: Always from duration periods ago to today (isIncluded not used)
        const start = today.clone().subtract(duration, unit).startOf(startOfUnit);
        const end = today.clone();
        return { startDate: start.toDate(), endDate: end.toDate() };
      } else {
        // Calendar mode: Use isIncluded to determine if current period is included
        if (isIncluded) {
          // Include current period: from start of last complete period to today
          // Example: "In Last 1 Month" including current = Oct 1 to Nov 5 (today)
          const start = today.clone().subtract(duration, unit).startOf(startOfUnit);
          const end = today.clone();
          return { startDate: start.toDate(), endDate: end.toDate() };
        } else {
          // Exclude current period: full complete periods only
          // Example: "In Last 1 Month" excluding current = Oct 1 to Oct 31
          const start = today.clone().subtract(duration, unit).startOf(startOfUnit);
          const end = today.clone().subtract(1, unit).endOf(startOfUnit);
          return { startDate: start.toDate(), endDate: end.toDate() };
        }
      }
    }

    case 'In Next': {
      if (!duration || !durationType) return null;

      if (isCurrent) {
        // Current mode: from today to duration periods ahead (isIncluded not used)
        const start = today.clone();
        const end = today.clone().add(duration, unit).endOf(startOfUnit);
        return { startDate: start.toDate(), endDate: end.toDate() };
      } else {
        // Calendar mode: Use isIncluded to determine if current period is included
        if (isIncluded) {
          // Include current period: from today to end of future period
          // Example: "In Next 1 Month" including current = Nov 5 (today) to Dec 31
          const start = today.clone();
          const end = today.clone().add(duration, unit).endOf(startOfUnit);
          return { startDate: start.toDate(), endDate: end.toDate() };
        } else {
          // Exclude current period: full future periods only
          // Example: "In Next 1 Month" excluding current = Dec 1 to Dec 31
          const start = today.clone().add(1, unit).startOf(startOfUnit);
          const end = today.clone().add(duration, unit).endOf(startOfUnit);
          return { startDate: start.toDate(), endDate: end.toDate() };
        }
      }
    }

    case 'In This': {
      if (!durationType) return null;

      if (isCurrent) {
        // Current mode: from start of period to today (isIncluded not used)
        const start = today.clone().startOf(startOfUnit);
        const end = today.clone();
        return { startDate: start.toDate(), endDate: end.toDate() };
      } else {
        // Calendar mode: full current period (isIncluded not applicable for "In This")
        return {
          startDate: today.clone().startOf(startOfUnit).toDate(),
          endDate: today.clone().endOf(startOfUnit).toDate(),
        };
      }
    }

    default:
      return null;
  }
}