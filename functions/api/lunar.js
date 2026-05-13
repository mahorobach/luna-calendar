import {
  csvResponse,
  errorResponse,
  fetchOfficialLunarCsv,
  getMonthFromRequest,
  getYearFromRequest,
} from "../_shared/official-data.js";

export async function onRequestGet({ request }) {
  try {
    const year = getYearFromRequest(request);
    const month = getMonthFromRequest(request);
    return csvResponse(await fetchOfficialLunarCsv(year, month));
  } catch (error) {
    return errorResponse(error);
  }
}
