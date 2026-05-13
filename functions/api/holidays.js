import {
  csvResponse,
  errorResponse,
  fetchOfficialHolidaysCsv,
  getYearFromRequest,
} from "../_shared/official-data.js";

export async function onRequestGet({ request }) {
  try {
    const year = getYearFromRequest(request);
    return csvResponse(await fetchOfficialHolidaysCsv(year));
  } catch (error) {
    return errorResponse(error);
  }
}
