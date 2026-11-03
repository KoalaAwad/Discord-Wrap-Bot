import { config, type MonthDay } from "../config";

function at(year: number, { month, day }: MonthDay) {
  return new Date(year, month - 1, day).getTime();
}

/** Start of the window and the first instant after it ends, for `year`. */
export function wrapWindow(year: number) {
  return {
    opens: at(year, config.WRAP_START),
    closes: at(year, config.WRAP_END) + 24 * 60 * 60 * 1000,
  };
}

/** The wrap covers the whole calendar year in the host's local time. */
export function yearRange(year: number) {
  return {
    start: new Date(year, 0, 1).getTime(),
    end: new Date(year + 1, 0, 1).getTime(),
  };
}

export type WrapStatus = {
  /** True during wrap week. */
  open: boolean;
  /** The year /wrap shows: this year while open, otherwise last finished one. */
  year: number;
  /** When the next wrap week starts (equals now's window when open). */
  nextOpens: number;
};

export function wrapStatus(now = Date.now()): WrapStatus {
  const year = new Date(now).getFullYear();
  const window = wrapWindow(year);

  if (now >= window.opens && now < window.closes) {
    return { open: true, year, nextOpens: window.opens };
  }
  if (now < window.opens) {
    return { open: false, year: year - 1, nextOpens: window.opens };
  }
  return { open: false, year, nextOpens: wrapWindow(year + 1).opens };
}
