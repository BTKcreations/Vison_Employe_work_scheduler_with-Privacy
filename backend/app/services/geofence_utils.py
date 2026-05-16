"""
Geofence and attendance anti-manipulation utilities.
"""
import math
from typing import List, Optional, Dict
from datetime import datetime, timedelta


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Calculate the great-circle distance between two points on Earth using the Haversine formula.
    Returns distance in meters.
    """
    R = 6371000  # Earth's radius in meters

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)

    a = (math.sin(delta_phi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def is_within_geofence(
    lat: float, lng: float,
    office_lat: float, office_lng: float,
    radius_meters: float
) -> bool:
    """Check if coordinates are within the geofence radius of the office."""
    distance = haversine_distance(lat, lng, office_lat, office_lng)
    return distance <= radius_meters


def calculate_drift_km(
    loc_in: Optional[Dict[str, float]],
    loc_out: Optional[Dict[str, float]]
) -> Optional[float]:
    """
    Calculate the distance drift between check-in and check-out locations.
    Returns distance in kilometers, or None if either location is missing.
    """
    if not loc_in or not loc_out:
        return None

    distance_m = haversine_distance(
        loc_in["lat"], loc_in["lng"],
        loc_out["lat"], loc_out["lng"]
    )
    return round(distance_m / 1000, 2)


def detect_anomalies(
    check_in_time: datetime,
    check_out_time: Optional[datetime],
    location_in: Optional[Dict[str, float]],
    location_out: Optional[Dict[str, float]],
    work_start_hour: int = 9,
    work_end_hour: int = 18,
    drift_threshold_km: float = 5.0,
    min_session_minutes: int = 30,
    device_fingerprint: Optional[str] = None,
    previous_fingerprint: Optional[str] = None,
) -> List[str]:
    """
    Detect anomalies in an attendance session.
    Returns a list of flag strings describing each anomaly found.
    """
    flags = []

    # 1. Off-hours check-in (before 5 AM or after 11 PM)
    local_hour = check_in_time.hour
    if local_hour < 5 or local_hour >= 23:
        flags.append("off_hours_checkin")

    # 2. Suspicious coordinates (latitude/longitude out of valid range or at 0,0)
    if location_in:
        lat, lng = location_in.get("lat", 0), location_in.get("lng", 0)
        if abs(lat) < 0.01 and abs(lng) < 0.01:
            flags.append("suspicious_coordinates")
        if abs(lat) > 90 or abs(lng) > 180:
            flags.append("invalid_coordinates")

    # 3. Location drift (check-out far from check-in)
    if check_out_time and location_in and location_out:
        drift = calculate_drift_km(location_in, location_out)
        if drift is not None and drift > drift_threshold_km:
            flags.append(f"location_drift_{drift}km")

    # 4. Very short session
    if check_out_time:
        session_minutes = (check_out_time - check_in_time).total_seconds() / 60
        if session_minutes < min_session_minutes:
            flags.append("short_session")

    # 5. Device fingerprint change
    if (device_fingerprint and previous_fingerprint and
            device_fingerprint != previous_fingerprint):
        flags.append("device_changed")

    return flags


def get_distance_to_office(
    lat: float, lng: float,
    office_lat: Optional[float], office_lng: Optional[float]
) -> Optional[float]:
    """Get distance from current location to office in meters. Returns None if office not configured."""
    if office_lat is None or office_lng is None:
        return None
    return round(haversine_distance(lat, lng, office_lat, office_lng), 1)
