import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Specs = z.object({
  found: z.boolean(),
  name: z.string(),
  kind: z.enum(["Small van", "Medium van", "Large van", "Truck", "Car"]),
  fuel: z.enum(["diesel", "petrol"]),
  fuelPer100km: z.number(),
  upkeepPerKm: z.number(),
  capacityParcels: z.number(),
  payloadKg: z.number(),
});
export type VehicleSpecs = z.infer<typeof Specs>;

/** Looks up typical urban specs for any vehicle model via Lovable AI. */
export const lookupVehicleSpecs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ query: z.string().trim().min(2).max(120) }).parse(d))
  .handler(async ({ data }): Promise<{ specs: VehicleSpecs | null; error: string | null }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { specs: null, error: "AI lookup isn't configured." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output, NoObjectGeneratedError } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        output: Output.object({ schema: Specs }),
        system:
          "You are a fleet data assistant for a courier company in Chișinău, Moldova. Given a vehicle model typed by a dispatcher, return its full canonical name (make, model, engine), class, fuel type (electric/hybrid/LPG are not supported: pick the closest of diesel or petrol), typical URBAN fuel consumption in L/100 km, running cost per km in MDL excluding fuel (tyres, service, depreciation; typically 0.8–2.5), parcel capacity (standard small parcels, ~60 for a small van, ~140 medium, ~220 large) and payload in kg. Use realistic manufacturer/real-world figures. Set found=false only if the text is clearly not a vehicle.",
        prompt: data.query,
        providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", include: ["reasoning.encrypted_content"] } },
      });
      const specs = await result.output;
      if (!specs.found) return { specs: null, error: "That doesn't look like a vehicle model." };
      return { specs, error: null };
    } catch (e) {
      if (NoObjectGeneratedError.isInstance(e)) return { specs: null, error: "Couldn't read the specs, try a more precise name." };
      const status = (e as { statusCode?: number }).statusCode;
      console.error("lookupVehicleSpecs", e);
      return { specs: null, error: status === 402 ? "AI credits are used up." : status === 429 ? "Too many lookups, try again in a minute." : "Lookup failed, try again." };
    }
  });
