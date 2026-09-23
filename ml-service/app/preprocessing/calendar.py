"""Indian festival / holiday calendar.

Lunar festival dates (Holi, Eid, Diwali, Raksha Bandhan, Ganesh Chaturthi,
Dussehra) shift every year. This module is therefore keyed **by year**: a year
with no lunar table degrades to "no festival signal" instead of applying a
2026 multiplier to a 2027 date.

Adding a year: extend ``LUNAR_FESTIVALS`` with verified dates. The fixed
(solar) holidays in ``SOLAR_HOLIDAYS`` apply to every year and need no work.
"""

from datetime import datetime
from typing import Dict, Tuple

# Solar holidays — same month/day every year.
# (month, day) -> (sales multiplier, label)
SOLAR_HOLIDAYS: Dict[Tuple[int, int], Tuple[float, str]] = {
    (1, 1): (2.3, "New Year Day"),
    (1, 14): (2.4, "Makar Sankranti / Pongal"),
    (1, 26): (2.2, "Republic Day Holiday"),
    (4, 14): (1.8, "Ambedkar Jayanti / Baisakhi"),
    (5, 1): (1.7, "May Day Holiday"),
    (8, 15): (2.5, "Independence Day Mega Sale"),
    (10, 2): (2.0, "Gandhi Jayanti"),
    (12, 25): (2.4, "Christmas Day"),
    (12, 31): (2.5, "New Year's Eve Rush"),
}

# Lunar / movable festivals, keyed by year.
LUNAR_FESTIVALS: Dict[int, Dict[Tuple[int, int], Tuple[float, str]]] = {
    2026: {
        (3, 3): (2.4, "Holi Festive Rush"),
        (3, 4): (2.2, "Holi Celebrations"),
        (3, 20): (2.1, "Eid-ul-Fitr"),
        (6, 16): (2.3, "Eid-ul-Adha (Bakrid)"),
        (6, 17): (2.0, "Bakrid Celebrations"),
        (8, 28): (2.6, "Raksha Bandhan Festive Rush"),
        (8, 29): (2.4, "Raksha Bandhan"),
        (9, 1): (2.7, "Ganesh Chaturthi Pooja Rush"),
        (9, 2): (2.5, "Ganesh Chaturthi Celebrations"),
        (10, 19): (2.8, "Dussehra / Navratri Peak"),
        (10, 20): (2.6, "Vijayadashami"),
        (11, 7): (3.0, "Dhanteras Mega Shopping"),
        (11, 8): (3.2, "Diwali Grand Festival"),
        (11, 9): (2.8, "Diwali Govardhan Pooja"),
        (11, 10): (2.5, "Bhai Dooj"),
    },
    # 2027 intentionally lists only solar holidays, which ``SOLAR_HOLIDAYS``
    # already covers. Lunar dates must be verified and added before the model
    # is relied on for 2027 planning — see ``years_missing_lunar_data``.
}

MONTH_START_DAYS = (1, 2, 3, 4)
MONTH_START_MULTIPLIER = 1.35
MONTH_START_LABEL = "Month-Start Grocery Restock"


def years_missing_lunar_data() -> Tuple[int, ...]:
    """Years that fall back to solar-only holidays.

    Useful for surfacing a warning: the model still works, but it is blind to
    Diwali/Eid/Holi in these years.
    """
    current = datetime.now().year
    candidates = (current, current + 1)
    return tuple(y for y in candidates if y not in LUNAR_FESTIVALS)


def get_festival_info(dt: datetime) -> Tuple[bool, float, str]:
    """Return ``(is_special_day, multiplier, label)`` for a date.

    Festivals take precedence over the month-start restock window.
    """
    key = (dt.month, dt.day)

    lunar = LUNAR_FESTIVALS.get(dt.year, {})
    if key in lunar:
        mult, label = lunar[key]
        return True, mult, label

    if key in SOLAR_HOLIDAYS:
        mult, label = SOLAR_HOLIDAYS[key]
        return True, mult, label

    if dt.day in MONTH_START_DAYS:
        return True, MONTH_START_MULTIPLIER, MONTH_START_LABEL

    return False, 1.0, "Regular Day"


def is_indian_festival_or_holiday(dt: datetime) -> Tuple[bool, float, str]:
    """Backwards-compatible alias for :func:`get_festival_info`."""
    return get_festival_info(dt)
