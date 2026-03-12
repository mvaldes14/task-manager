"""Natural language processing — date/time/recurrence parsing."""

import json, re, os
from datetime import date, timedelta

OBSIDIAN_VAULT = os.environ.get('OBSIDIAN_VAULT', '').strip()
OBSIDIAN_INBOX = os.environ.get('OBSIDIAN_INBOX', '').strip().strip('/')

DAYS   = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
MONTHS = ['january','february','march','april','may','june','july','august',
          'september','october','november','december']


def parse_recurrence(text):
    tl = text.lower()
    rule = None

    if re.search(r'\bevery\s+day\b|\bdaily\b', tl):
        rule = {"type": "daily"}
        text = re.sub(r'\bevery\s+day\b|\bdaily\b', '', text, flags=re.IGNORECASE)
    elif re.search(r'\bevery\s+weekday\b', tl):
        rule = {"type": "weekly", "days": [0,1,2,3,4]}
        text = re.sub(r'\bevery\s+weekday\b', '', text, flags=re.IGNORECASE)
    elif re.search(r'\bevery\s+weekend\b', tl):
        rule = {"type": "weekly", "days": [5,6]}
        text = re.sub(r'\bevery\s+weekend\b', '', text, flags=re.IGNORECASE)
    elif re.search(r'\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)', tl):
        day_names = re.findall(r'\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b', tl)
        days = sorted(set(DAYS.index(d) for d in day_names))
        rule = {"type": "weekly", "days": days}
        text = re.sub(r'\bevery\s+((monday|tuesday|wednesday|thursday|friday|saturday|sunday)(\s*,?\s*and?\s*|\s*,\s*)?)+', '', text, flags=re.IGNORECASE)
    elif m := re.search(r'\bevery\s+(\d+)\s+(day|days|week|weeks)\b', tl):
        n = int(m.group(1)); unit = m.group(2)
        rule = {"type": "interval", "days": n * 7 if 'week' in unit else n}
        text = text[:m.start()] + text[m.end():]
    elif re.search(r'\bevery\s+other\s+week\b', tl):
        rule = {"type": "interval", "days": 14}
        text = re.sub(r'\bevery\s+other\s+week\b', '', text, flags=re.IGNORECASE)
    elif re.search(r'\bend\s+of\s+(?:the\s+)?month\b|\blast\s+day\s+of\s+(?:the\s+)?month\b', tl):
        rule = {"type": "monthly_dom", "dom": -1}  # -1 = last day of month
        text = re.sub(r'\bend\s+of\s+(?:the\s+)?month\b|\blast\s+day\s+of\s+(?:the\s+)?month\b', '', text, flags=re.IGNORECASE)
    elif re.search(r'\b(?:1st|first)\s+of\s+(?:the\s+)?month\b|\bstart\s+of\s+(?:the\s+)?month\b', tl):
        rule = {"type": "monthly_dom", "dom": 1}
        text = re.sub(r'\b(?:1st|first)\s+of\s+(?:the\s+)?month\b|\bstart\s+of\s+(?:the\s+)?month\b', '', text, flags=re.IGNORECASE)
    elif re.search(r'\bevery\s+month\b|\bmonthly\b', tl):
        dom_m = re.search(r'\b(\d{1,2})(?:st|nd|rd|th)?\b', tl)
        dom = int(dom_m.group(1)) if dom_m else None
        rule = {"type": "monthly_dom", "dom": dom if dom and 1 <= dom <= 31 else None}
        text = re.sub(r'\bevery\s+month\b|\bmonthly\b', '', text, flags=re.IGNORECASE)
    elif m := re.search(r'\b(first|second|third|fourth|last|1st|2nd|3rd|4th)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+of\s+(?:the\s+)?month)?\b', tl):
        ord_map = {'first':0,'1st':0,'second':1,'2nd':1,'third':2,'3rd':2,'fourth':3,'4th':3,'last':-1}
        rule = {"type": "monthly_dow", "week": ord_map.get(m.group(1), 0), "dow": DAYS.index(m.group(2))}
        text = text[:m.start()] + text[m.end():]
    elif re.search(r'\byearly\b|\bannually\b|\bevery\s+year\b', tl):
        rule = {"type": "yearly"}
        text = re.sub(r'\byearly\b|\bannually\b|\bevery\s+year\b', '', text, flags=re.IGNORECASE)
    elif re.search(r'\bevery\s+week\b|\bweekly\b', tl):
        rule = {"type": "interval", "days": 7}
        text = re.sub(r'\bevery\s+week\b|\bweekly\b', '', text, flags=re.IGNORECASE)

    return (json.dumps(rule) if rule else None), text.strip()


def _nth_weekday_of_month(year, month, dow, n):
    import calendar
    if n == -1:
        last_day = calendar.monthrange(year, month)[1]
        d = date(year, month, last_day)
        while d.weekday() != dow: d -= timedelta(days=1)
        return d
    first = date(year, month, 1)
    first_occ = first + timedelta(days=(dow - first.weekday()) % 7)
    target = first_occ + timedelta(weeks=n)
    if target.month != month: target -= timedelta(weeks=1)
    return target


def next_due_date(rule_str, from_date):
    if not rule_str: return None
    try: rule = json.loads(rule_str)
    except: return None
    rtype = rule.get("type")
    if rtype == "daily": return from_date + timedelta(days=1)
    if rtype == "weekly":
        days = rule.get("days", [0]); cdow = from_date.weekday()
        for offset in range(1, 8):
            if (cdow + offset) % 7 in days: return from_date + timedelta(days=offset)
        return from_date + timedelta(days=7)
    if rtype == "interval": return from_date + timedelta(days=rule.get("days", 7))
    if rtype == "monthly_dom":
        import calendar
        dom = rule.get("dom"); month = from_date.month % 12 + 1
        year = from_date.year + (1 if from_date.month == 12 else 0)
        last_day = calendar.monthrange(year, month)[1]
        if dom == -1: return date(year, month, last_day)   # end of month
        if dom is None: dom = from_date.day
        return date(year, month, min(dom, last_day))
    if rtype == "monthly_dow":
        month = from_date.month % 12 + 1; year = from_date.year + (1 if from_date.month == 12 else 0)
        return _nth_weekday_of_month(year, month, rule.get("dow", 0), rule.get("week", 0))
    if rtype == "yearly": return date(from_date.year + 1, from_date.month, from_date.day)
    return None


def parse_natural_language(text):
    original = text
    result = {'title': text, 'due_date': None, 'due_time': None,
              'project_name': None, 'labels': [], 'nlp_summary': None,
              'obsidian_url': None, 'obsidian_new_url': None, 'links': [], 'recurrence': None}
    today = date.today()
    found_date = found_time = None

    recurrence_rule, text = parse_recurrence(text)

    wiki_match = re.search(r'!(\S+)', text)
    if wiki_match:
        note_name = wiki_match.group(1).strip()
        vault = OBSIDIAN_VAULT or 'vault'
        from urllib.parse import quote
        inbox_prefix = (OBSIDIAN_INBOX + '/') if OBSIDIAN_INBOX else ''
        result['obsidian_url']     = f"obsidian://open?vault={quote(vault)}&file={quote(inbox_prefix + note_name)}"
        result['obsidian_new_url'] = f"obsidian://new?vault={quote(vault)}&file={quote(inbox_prefix + note_name)}"
        result['obsidian_note']    = note_name
        text = text[:wiki_match.start()] + text[wiki_match.end():].strip()

    if not result['obsidian_url']:
        obs_match = re.search(r'obsidian://\S+', text)
        if obs_match:
            result['obsidian_url'] = obs_match.group(0)
            fn_match = re.search(r'[?&]file=([^&]+)', obs_match.group(0))
            if fn_match:
                from urllib.parse import unquote
                result['obsidian_note'] = unquote(fn_match.group(1))
            text = text[:obs_match.start()] + text[obs_match.end():].strip()

    m = re.search(r'#(\w+)', text)
    if m: result['project_name'] = m.group(1); text = re.sub(r'#\w+', '', text).strip()
    labels = re.findall(r'@(\w+)', text)
    if labels: result['labels'] = labels; text = re.sub(r'@\w+', '', text).strip()

    tl = text.lower().strip()
    for pat, kind in [(r'\bat\s+(\d{1,2}):(\d{2})\s*(am|pm)?\b','hm'),(r'\bat\s+(\d{1,2})\s*(am|pm)\b','h'),
                      (r'\b(\d{1,2}):(\d{2})\s*(am|pm)\b','hm'),(r'\b(\d{1,2})\s*(am|pm)\b','h')]:
        m = re.search(pat, tl)
        if m:
            try:
                h, mi = (int(m.group(1)), int(m.group(2))) if kind == 'hm' else (int(m.group(1)), 0)
                mer = m.group(3 if kind == 'hm' else 2) if m.lastindex >= (3 if kind == 'hm' else 2) else None
                if mer == 'pm' and h < 12: h += 12
                elif mer == 'am' and h == 12: h = 0
                found_time = f"{h:02d}:{mi:02d}"; text = text[:m.start()] + text[m.end():]
                text = re.sub(r'\bat\s*$', '', text).strip(); break
            except: pass

    text = re.sub(r'\bby\s+(?=(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|tonight|next|this|\d))', '', text, flags=re.IGNORECASE).strip()
    tlc = text.lower()

    m = re.search(r'\b(next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b', tlc)
    if m:
        mod, dn = m.group(1), m.group(2); tdow = DAYS.index(dn); cdow = today.weekday()
        delta = (tdow - cdow) % 7 or 7
        found_date = today + timedelta(days=delta if mod == 'this' else max(delta, 7))
        text = text[:m.start()] + text[m.end():]

    if not found_date:
        m = re.search(r'\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b', tlc)
        if m:
            found_date = today + timedelta(days=(DAYS.index(m.group(1)) - today.weekday()) % 7 or 7)
            text = text[:m.start()] + text[m.end():]

    if not found_date:
        if re.search(r'\btonight\b', tlc):
            found_date = today; found_time = found_time or "20:00"; text = re.sub(r'\btonight\b', '', text, flags=re.IGNORECASE)
        elif re.search(r'\btomorrow\b', tlc):
            found_date = today + timedelta(1); text = re.sub(r'\btomorrow\b', '', text, flags=re.IGNORECASE)
        elif re.search(r'\btoday\b', tlc):
            found_date = today; text = re.sub(r'\btoday\b', '', text, flags=re.IGNORECASE)

    if not found_date:
        m = re.search(r'\bin\s+(\d+)\s+(day|days|week|weeks)\b', tlc)
        if m:
            n = int(m.group(1))
            found_date = today + timedelta(weeks=n if 'week' in m.group(2) else 0, days=0 if 'week' in m.group(2) else n)
            text = text[:m.start()] + text[m.end():]

    if not found_date:
        if re.search(r'\bnext\s+week\b', tlc):
            found_date = today + timedelta(weeks=1); text = re.sub(r'\bnext\s+week\b', '', text, flags=re.IGNORECASE)
        elif re.search(r'\bnext\s+month\b', tlc):
            month = today.month % 12 + 1; year = today.year + (1 if today.month == 12 else 0)
            found_date = today.replace(year=year, month=month, day=1)
            text = re.sub(r'\bnext\s+month\b', '', text, flags=re.IGNORECASE)

    if not found_date:
        m = re.search(r'\b(' + '|'.join(MONTHS) + r')\s+(\d{1,2})(?:st|nd|rd|th)?\b', tlc)
        if m:
            try:
                mn = MONTHS.index(m.group(1)) + 1; dn = int(m.group(2))
                c = date(today.year, mn, dn)
                found_date = c if c >= today else date(today.year + 1, mn, dn)
                text = text[:m.start()] + text[m.end():]
            except: pass

    if not found_date:
        m = re.search(r'\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b', text)
        if m:
            try:
                mo, dy = int(m.group(1)), int(m.group(2)); yr = int(m.group(3)) if m.group(3) else today.year
                if yr < 100: yr += 2000
                found_date = date(yr, mo, dy); text = text[:m.start()] + text[m.end():]
            except: pass

    if not found_date and re.search(r'\b(end of week|eow|weekend)\b', tlc):
        found_date = today + timedelta(days=(5 - today.weekday()) % 7 or 7)
        text = re.sub(r'\b(end of week|eow|weekend)\b', '', text, flags=re.IGNORECASE)

    if found_date: result['due_date'] = found_date.isoformat()
    if found_time: result['due_time'] = found_time

    if recurrence_rule:
        result['recurrence'] = recurrence_rule
        if not found_date:
            rule = json.loads(recurrence_rule); rtype = rule.get('type')
            if rtype == 'daily': found_date = today + timedelta(days=1)
            elif rtype == 'weekly':
                days = rule.get('days', [0]); cdow = today.weekday()
                found_date = today + timedelta(days=min((d - cdow) % 7 or 7 for d in days))
            elif rtype == 'interval': found_date = today + timedelta(days=rule.get('days', 7))
            elif rtype in ('monthly_dom', 'monthly_dow', 'yearly'): found_date = next_due_date(recurrence_rule, today)
            if found_date: result['due_date'] = found_date.isoformat()

    title = re.sub(r'\s+', ' ', text).strip()
    title = re.sub(r'^[,.\-]\s*', '', title); title = re.sub(r'\s*[,.]$', '', title)
    result['title'] = title or original

    parts = []
    if result['project_name']: parts.append(f"#{result['project_name']}")
    if found_date: parts.append(f"due {found_date.strftime('%a %b %-d')}")
    if found_time:
        h, mi = map(int, found_time.split(':'))
        parts.append(f"at {h%12 or 12}:{mi:02d}{'am' if h<12 else 'pm'}")
    if result['labels']: parts.append(' '.join(f"@{l}" for l in result['labels']))
    if result.get('recurrence'):
        r = json.loads(result['recurrence']); rtype = r.get('type', '')
        rlabel = {'daily':'daily','interval':f"every {r.get('days',7)}d",'yearly':'yearly'}.get(rtype)
        if not rlabel:
            if rtype == 'weekly': rlabel = 'weekly ' + ','.join(['M','T','W','Th','F','Sa','Su'][d] for d in r.get('days',[]))
            elif rtype == 'monthly_dom': rlabel = f"monthly (day {r.get('dom','?')})"
            elif rtype == 'monthly_dow': rlabel = 'monthly (weekday)'
        parts.append(f"🔁 {rlabel}")
    if result.get('obsidian_url'): parts.append(f"📎 {result.get('obsidian_note','obsidian')}")
    if parts: result['nlp_summary'] = ' · '.join(parts)
    return result
