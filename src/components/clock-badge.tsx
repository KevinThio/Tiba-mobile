import { Badge } from "@/components/ui/badge";
import { placeLabel, PLACE_BADGE, type ClockPlace } from "@/lib/clock-place";

/** Where a clock-in or clock-out happened: "At the patient's home", "2.3 km from the patient's home"… */
export function ClockPlaceBadge({ place, distanceM }: { place: ClockPlace; distanceM: number | null }) {
  return <Badge variant={PLACE_BADGE[place]}>{placeLabel(place, distanceM)}</Badge>;
}
