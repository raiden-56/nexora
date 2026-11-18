import { body, route } from "@/server/http";
import { onboard, onboardingSchema } from "@/server/services/org";

export const POST = route(async (req) => onboard(await body(req, onboardingSchema)));
