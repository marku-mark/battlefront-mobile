import { apiRequest } from "./backend";
import { createPcBuilderApi } from "./pcBuilderApi";
export const pcBuilder = createPcBuilderApi(apiRequest);
