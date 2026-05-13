import {
  csvResponse,
  errorResponse,
  fetchOfficialSolarTermsCsv,
  getYearFromRequest,
} from "../_shared/official-data.js";

export async function onRequestGet({ request }) {
  try {
    const year = getYearFromRequest(request);
    return csvResponse(await fetchOfficialSolarTermsCsv(year));
  } catch (error) {
    return errorResponse(error);
  }
}
