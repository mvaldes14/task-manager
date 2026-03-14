"""Natural language processing — date/time/recurrence parsing.

Recurrence: stored as RRULE strings (RFC 5545) via dateutil.rrule
One-off dates: parsed by dateparser, fallback regex for structural shortcuts
"""

import json, logging, re, os
from datetime import date, datetime, timedelta
from urllib.parse import quote, unquote
from dateutil.rrule import rrule, rrulestr, DAILY, WEEKLY, MONTHLY, YEARLY, MO, TU, WE, TH, FR, SA, SU
import dateparser

logger = logging.getLogger(__name__)

OBSIDIAN_VAULT  = os.environ.get('OBSIDIAN_VAULT', '').strip()
OBSIDIAN_INBOX  = os.environ.get('OBSIDIAN_INBOX', '').strip().strip('/')

DAYS     = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
WEEKDAYS = [MO, TU, WE, TH, FR, SA, SU]

DATEPARSER_SETTINGS = {
    'PREFER_DATES_FROM': 'future',
    'PREFER_DAY_OF_MONTH': 'first',
    'RETURN_AS_TIMEZONE_AWARE': False,
    'TO_TIMEZONE': 'UTC',
}


# ── RRULE helpers ──────────────────────────────────────────────────────────────

def next_due_date(rrule_str, from_date):
    """Return the next occurrence after from_date for an RRULE string."""
    if not rrule_str:
        return None
    try:
        after = datetime.combine(from_date, datetime.min.time())
        rule  = rrulestr(rrule_str, dtstart=after)
        nxt   = rule.after(after)
        return nxt.date() if nxt else None
    except Exception:
        return None


def _rrule_to_str(rule):
    """Serialise a rrule object to a clean RRULE:... string."""
    raw = str(rule).strip()
    lines = raw.splitlines()
    for ln in lines:
        if ln.startswith('RRULE:'):
            return ln
    # fallback — strip DTSTART line
    return re.sub(r'DTSTART:[^\n]+\n?', '', raw, flags=re.MULTILINE).strip()


def rrule_from_text(text):
    """Parse recurrence keywords from text; return (rrule_str|None, cleaned_text)."""
    tl   = text.lower()
    rule = None

    if re.search(r'\bevery\s+day\b|\bdaily\b', tl):
        rule = rrule(DAILY)
        text = re.sub(r'\bevery\s+day\b|\bdaily\b', '', text, flags=re.IGNORECASE)

    elif re.search(r'\bevery\s+weekday\b|\bweekdays\b', tl):
        rule = rrule(WEEKLY, byweekday=[MO, TU, WE, TH, FR])
        text = re.sub(r'\bevery\s+weekday\b|\bweekdays\b', '', text, flags=re.IGNORECASE)

    elif re.search(r'\bevery\s+weekend\b', tl):
        rule = rrule(WEEKLY, byweekday=[SA, SU])
        text = re.sub(r'\bevery\s+weekend\b', '', text, flags=re.IGNORECASE)

    elif m := re.search(
            r'\bevery\s+((?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)'
            r'(?:\s*(?:,|and)\s*)?)+)', tl):
        day_names = re.findall(
            r'monday|tuesday|wednesday|thursday|friday|saturday|sunday', m.group(1))
        wdays = [WEEKDAYS[DAYS.index(d)] for d in day_names]
        rule  = rrule(WEEKLY, byweekday=wdays)
        text  = text[:m.start()] + text[m.end():]

    elif m := re.search(r'\bevery\s+(\d+)\s+(day|days|week|weeks)\b', tl):
        n, unit = int(m.group(1)), m.group(2)
        rule = rrule(WEEKLY, interval=n) if 'week' in unit else rrule(DAILY, interval=n)
        text = text[:m.start()] + text[m.end():]

    elif re.search(r'\bevery\s+other\s+week\b', tl):
        rule = rrule(WEEKLY, interval=2)
        text = re.sub(r'\bevery\s+other\s+week\b', '', text, flags=re.IGNORECASE)

    elif re.search(r'\bend\s+of\s+(?:the\s+)?month\b|\blast\s+day\s+of\s+(?:the\s+)?month\b', tl):
        rule = rrule(MONTHLY, bymonthday=-1)
        text = re.sub(
            r'\bend\s+of\s+(?:the\s+)?month\b|\blast\s+day\s+of\s+(?:the\s+)?month\b',
            '', text, flags=re.IGNORECASE)

    elif re.search(r'\b(?:1st|first)\s+of\s+(?:the\s+)?month\b|\bstart\s+of\s+(?:the\s+)?month\b', tl):
        rule = rrule(MONTHLY, bymonthday=1)
        text = re.sub(
            r'\b(?:1st|first)\s+of\s+(?:the\s+)?month\b|\bstart\s+of\s+(?:the\s+)?month\b',
            '', text, flags=re.IGNORECASE)

    elif m := re.search(r'\bevery\s+(\d{1,2})(?:st|nd|rd|th)\b', tl):
        dom = int(m.group(1))
        if 1 <= dom <= 31:
            rule = rrule(MONTHLY, bymonthday=dom)
        text = text[:m.start()] + text[m.end():]

    elif re.search(r'\bevery\s+month\b|\bmonthly\b', tl):
        dom_m = re.search(r'\b(\d{1,2})(?:st|nd|rd|th)?\b', tl)
        dom   = int(dom_m.group(1)) if dom_m and 1 <= int(dom_m.group(1)) <= 31 else None
        rule  = rrule(MONTHLY, bymonthday=dom) if dom else rrule(MONTHLY)
        text  = re.sub(r'\bevery\s+month\b|\bmonthly\b', '', text, flags=re.IGNORECASE)

    elif m := re.search(
            r'\b(first|second|third|fourth|last|1st|2nd|3rd|4th)\s+'
            r'(monday|tuesday|wednesday|thursday|friday|saturday|sunday)'
            r'(?:\s+of\s+(?:the\s+)?month)?\b', tl):
        ord_map = {'first':1,'1st':1,'second':2,'2nd':2,
                   'third':3,'3rd':3,'fourth':4,'4th':4,'last':-1}
        n    = ord_map.get(m.group(1), 1)
        wday = WEEKDAYS[DAYS.index(m.group(2))]
        rule = rrule(MONTHLY, byweekday=wday(n))
        text = text[:m.start()] + text[m.end():]

    elif re.search(r'\byearly\b|\bannually\b|\bevery\s+year\b', tl):
        rule = rrule(YEARLY)
        text = re.sub(r'\byearly\b|\bannually\b|\bevery\s+year\b', '', text, flags=re.IGNORECASE)

    elif re.search(r'\bevery\s+week\b|\bweekly\b', tl):
        rule = rrule(WEEKLY)
        text = re.sub(r'\bevery\s+week\b|\bweekly\b', '', text, flags=re.IGNORECASE)

    if rule is None:
        return None, text.strip()

    return _rrule_to_str(rule), text.strip()


# ── Time helpers ───────────────────────────────────────────────────────────────

_TIME_SLOTS = [
    (r'\bnoon\b',                                     '12:00', None),
    (r'\bmidnight\b',                                 '00:00', None),
    (r'\b(end\s+of\s+day|eod)\b',                    '17:00', None),
    (r'\btomorrow\s+morning\b',                       '09:00', 'tomorrow'),
    (r'\bin\s+the\s+morning\b|\bthis\s+morning\b',   '09:00', 'today'),
    (r'\bthis\s+afternoon\b|\bin\s+the\s+afternoon\b','14:00','today'),
    (r'\bthis\s+evening\b',                           '19:00', 'today'),
    (r'\btonight\b',                                  '20:00', 'today'),
]


def _parse_time_slots(text, found_date, today):
    tl = text.lower()
    for pattern, tval, hint in _TIME_SLOTS:
        if re.search(pattern, tl):
            if hint == 'today'    and not found_date: found_date = today
            if hint == 'tomorrow' and not found_date: found_date = today + timedelta(1)
            text = re.sub(pattern, '', text, flags=re.IGNORECASE).strip()
            return text, found_date, tval
    return text, found_date, None


def _parse_explicit_time(text):
    tl = text.lower()
    for pat, kind in [
        (r'\bat\s+(\d{1,2}):(\d{2})\s*(am|pm)?\b', 'hm'),
        (r'\bat\s+(\d{1,2})\s*(am|pm)\b',           'h'),
        (r'\b(\d{1,2}):(\d{2})\s*(am|pm)?\b',       'hm'),
        (r'\b(\d{1,2})\s*(am|pm)\b',                'h'),
    ]:
        m = re.search(pat, tl)
        if m:
            try:
                if kind == 'hm':
                    h, mi = int(m.group(1)), int(m.group(2))
                    mer   = m.group(3) if m.lastindex >= 3 else None
                else:
                    h, mi = int(m.group(1)), 0
                    mer   = m.group(2) if m.lastindex >= 2 else None
                if mer == 'pm' and h < 12: h += 12
                elif mer == 'am' and h == 12: h = 0
                # bare HH:MM — assume AM (per user preference)
                text = text[:m.start()] + text[m.end():]
                text = re.sub(r'\bat\s*$', '', text).strip()
                return text, f"{h:02d}:{mi:02d}"
            except Exception:
                pass
    return text, None


# Ordered from most-specific to least-specific so we extract the right fragment
_DATE_SIGNAL_PATTERNS = [
    # relative phrases
    r'in\s+\d+\s+(?:days?|weeks?)',
    r'next\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)',
    r'this\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)',
    r'end\s+of\s+week',
    r'\beow\b',
    r'\bweekend\b',
    # single keywords  (tonight is handled by time slots, not date signals)
    r'\btomorrow\b',
    r'\btoday\b',
    # day names
    r'\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b',
    # month + day  e.g. "march 15th"
    r'(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?',
    # numeric dates
    r'\d{1,2}/\d{1,2}(?:/\d{2,4})?',
]

_DATE_SIGNAL_RE = re.compile(
    '|'.join(f'(?:{p})' for p in _DATE_SIGNAL_PATTERNS),
    re.IGNORECASE)


def _parse_date(text, today):
    """Extract date signal, parse with dateparser, remove signal from text."""
    # Strip leading "by" before date expressions
    cleaned = re.sub(
        r'\bby\s+(?=(monday|tuesday|wednesday|thursday|friday|saturday|sunday'
        r'|tomorrow|today|tonight|next|this|\d|eow|end))',
        '', text, flags=re.IGNORECASE).strip()

    m = _DATE_SIGNAL_RE.search(cleaned)
    if not m:
        return text, None

    fragment = m.group(0)
    settings = {**DATEPARSER_SETTINGS,
                'RELATIVE_BASE': datetime.combine(today, datetime.min.time())}

    # "tonight" → today + 20:00 handled by time slots; treat as today for date
    parse_str = 'today' if fragment.lower() == 'tonight' else fragment
    parsed = dateparser.parse(parse_str, settings=settings)
    if not parsed:
        return text, None

    found_date = parsed.date()
    # Remove just the matched fragment from text
    remaining = cleaned[:m.start()] + cleaned[m.end():]
    remaining = re.sub(r'\bby\b', '', remaining, flags=re.IGNORECASE)
    remaining = re.sub(r'\s+', ' ', remaining).strip()
    return remaining, found_date


# ── Main entry point ───────────────────────────────────────────────────────────

def parse_natural_language(text):
    original = text
    result = {
        'title': text, 'due_date': None, 'due_time': None,
        'project_name': None, 'labels': [], 'nlp_summary': None,
        'obsidian_url': None, 'obsidian_new_url': None,
        'links': [], 'recurrence': None,
    }
    today      = date.today()
    found_date = None
    found_time = None

    # 1. Recurrence — consume keywords before dateparser sees them
    rrule_str, text = rrule_from_text(text)

    # 2. Obsidian !NoteName shortcut
    wiki_match = re.search(r'!(\S+)', text)
    if wiki_match:
        note_name = wiki_match.group(1).strip()
        vault = OBSIDIAN_VAULT or 'vault'
        inbox_prefix = (OBSIDIAN_INBOX + '/') if OBSIDIAN_INBOX else ''
        result['obsidian_url']     = f"obsidian://search?vault={quote(vault)}&query={quote(note_name)}"
        result['obsidian_new_url'] = f"obsidian://new?vault={quote(vault)}&file={quote(inbox_prefix + note_name)}"
        result['obsidian_note']    = note_name
        text = text[:wiki_match.start()] + text[wiki_match.end():].strip()

    if not result['obsidian_url']:
        obs_match = re.search(r'obsidian://\S+', text)
        if obs_match:
            result['obsidian_url'] = obs_match.group(0)
            fn_match = re.search(r'[?&]file=([^&]+)', obs_match.group(0))
            if fn_match:
                result['obsidian_note'] = unquote(fn_match.group(1))
            text = text[:obs_match.start()] + text[obs_match.end():].strip()

    # 3. Project / labels
    m = re.search(r'#(\w+)', text)
    if m:
        result['project_name'] = m.group(1)
        text = re.sub(r'#\w+', '', text).strip()
    labels = re.findall(r'@(\w+)', text)
    if labels:
        result['labels'] = labels
        text = re.sub(r'@\w+', '', text).strip()

    # 4. Named time slots (must come before explicit time to avoid conflicts)
    text, found_date, slot_time = _parse_time_slots(text, found_date, today)
    if slot_time:
        found_time = slot_time

    # 5. Explicit clock time (3pm, 14:00, 9:30)
    text, clock_time = _parse_explicit_time(text)
    if clock_time and not found_time:
        found_time = clock_time

    # 6. One-off date via dateparser (skip if time slot already set a date)
    if not found_date:
        text, found_date = _parse_date(text, today)

    # 7. Store results
    if found_date:
        result['due_date'] = found_date.isoformat()
    if found_time:
        result['due_time'] = found_time

    # 8. Recurrence — if no explicit start date, calculate first occurrence
    if rrule_str:
        result['recurrence'] = rrule_str
        if not found_date:
            nxt = next_due_date(rrule_str, today - timedelta(1))
            if nxt:
                result['due_date'] = nxt.isoformat()

    # 9. Clean title
    title = re.sub(r'\s+', ' ', text).strip()
    title = re.sub(r'^[,.\-]\s*', '', title)
    title = re.sub(r'\s*[,.]$', '', title)
    result['title'] = title or original

    # 10. NLP summary
    parts = []
    if result['project_name']: parts.append(f"#{result['project_name']}")
    if result['due_date']:
        d = date.fromisoformat(result['due_date'])
        parts.append(f"due {d.strftime('%a %b %-d')}")
    if result['due_time']:
        h, mi = map(int, result['due_time'].split(':'))
        parts.append(f"at {h%12 or 12}:{mi:02d}{'am' if h < 12 else 'pm'}")
    if result['labels']:
        parts.append(' '.join(f"@{l}" for l in result['labels']))
    if rrule_str:
        parts.append(f"🔁 {rrule_label(rrule_str)}")
    if result.get('obsidian_url'):
        parts.append(f"📎 {result.get('obsidian_note', 'obsidian')}")
    if parts:
        result['nlp_summary'] = ' · '.join(parts)

    return result


# ── Human-readable RRULE label (used by backend summary + frontend utils.js) ──

def rrule_label(rrule_str):
    """Convert an RRULE string to a short human label."""
    if not rrule_str:
        return ''
    try:
        props = {}
        for part in rrule_str.replace('RRULE:', '').split(';'):
            if '=' in part:
                k, v = part.split('=', 1)
                props[k] = v

        freq       = props.get('FREQ', '')
        interval   = int(props.get('INTERVAL', 1))
        byday      = props.get('BYDAY', '')
        bymonthday = props.get('BYMONTHDAY', '')

        if freq == 'DAILY':
            return 'Daily' if interval == 1 else f'Every {interval} days'

        if freq == 'WEEKLY':
            days = [d.strip() for d in byday.split(',') if d.strip()]
            name_map = {'MO':'Mon','TU':'Tue','WE':'Wed','TH':'Thu',
                        'FR':'Fri','SA':'Sat','SU':'Sun'}
            if set(days) == {'MO','TU','WE','TH','FR'}:
                label = 'Weekdays'
            elif set(days) == {'SA','SU'}:
                label = 'Weekends'
            elif days:
                label = ', '.join(name_map.get(d, d) for d in days)
            else:
                label = 'Weekly'
            return label if interval == 1 else f'Every {interval} weeks · {label}'

        if freq == 'MONTHLY':
            if byday:
                m = re.match(r'(-?\d+)(MO|TU|WE|TH|FR|SA|SU)', byday)
                if m:
                    n, d = int(m.group(1)), m.group(2)
                    ord_l = {1:'1st',2:'2nd',3:'3rd',4:'4th',-1:'Last'}.get(n, f'{n}th')
                    day_l = {'MO':'Mon','TU':'Tue','WE':'Wed','TH':'Thu',
                             'FR':'Fri','SA':'Sat','SU':'Sun'}.get(d, d)
                    return f'{ord_l} {day_l} of month'
            if bymonthday:
                dom = int(bymonthday)
                if dom == -1: return 'End of month'
                suf = {1:'st',2:'nd',3:'rd'}.get(dom if dom <= 20 else dom % 10, 'th')
                return f'{dom}{suf} of month'
            return 'Monthly'

        if freq == 'YEARLY':
            return 'Yearly'

    except Exception:
        pass
    return rrule_str
