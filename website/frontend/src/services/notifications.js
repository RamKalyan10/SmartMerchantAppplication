/**
 * Notification derivation.
 *
 * The bell used to render a hardcoded array of five alerts — including a
 * sentence naming "Isolation Forest" and a ₹4,500 freight charge that existed
 * in no table. A merchant reading it would act on a transaction that was never
 * recorded.
 *
 * Every entry here is derived from a model output the API actually returned.
 * Nothing is written into the list that did not come from the store's own data,
 * and if a source feed fails the notification says so rather than falling back
 * to an example.
 */

const READ_KEY = 'sm_notif_read_ids';

/** Severity a model alert carries -> the badge style the bell understands. */
const SEVERITY_TO_TYPE = {
  critical: 'danger',
  warning: 'warning',
  success: 'success',
  info: 'info',
};

/** Which page a merchant should land on to act on this alert. */
const ALERT_TYPE_TO_PAGE = {
  INVENTORY: 'inventory',
  SALES: 'forecasting',
  EXPENSE: 'expenses',
};

const ALERT_TYPE_TO_ICON = {
  INVENTORY: '📦',
  SALES: '📈',
  EXPENSE: '🧾',
};

const SEVERITY_TO_ICON = {
  critical: '🚨',
  warning: '⚠️',
  success: '✅',
  info: 'ℹ️',
};

export function loadReadIds() {
  try {
    const raw = localStorage.getItem(READ_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveReadIds(ids) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    /* storage unavailable (private mode) — read state simply won't persist */
  }
}

/** Stable identity for an alert, so "read" survives a re-fetch. */
function alertId(alert, index) {
  return `alert:${alert.type || 'GEN'}:${alert.title || index}`;
}

function relativeTime(isoTimestamp) {
  if (!isoTimestamp) return '';
  const elapsedMs = Date.now() - new Date(isoTimestamp).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return '';
  const minutes = Math.floor(elapsedMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Turn the model responses into bell entries.
 *
 * @param {object} sources
 * @param {object|null} sources.insights   GET /api/forecast/insights
 * @param {object|null} sources.expenses   GET /api/forecast/expenses
 * @param {string|null} sources.fetchedAt  ISO timestamp of the fetch
 * @param {string[]}    sources.errors     feeds that failed to load
 */
export function buildNotifications({ insights, expenses, fetchedAt, errors = [] }) {
  const time = relativeTime(fetchedAt);
  const notifications = [];

  const alerts = Array.isArray(insights?.critical_alerts) ? insights.critical_alerts : [];
  alerts.forEach((alert, index) => {
    const severity = alert.severity || 'info';
    notifications.push({
      id: alertId(alert, index),
      title: alert.title || 'Business alert',
      description: alert.message || '',
      impact: alert.impact_metric || '',
      suggestedAction: alert.suggested_action || '',
      time,
      type: SEVERITY_TO_TYPE[severity] || 'info',
      category: severity === 'critical' || severity === 'warning' ? 'alerts' : 'updates',
      icon: SEVERITY_TO_ICON[severity] || 'ℹ️',
      targetPage: ALERT_TYPE_TO_PAGE[alert.type] || 'forecasting',
    });
  });

  const flagged = (expenses?.anomalies || []).filter((a) => a.is_anomaly);
  flagged.slice(0, 3).forEach((anomaly, index) => {
    notifications.push({
      id: `anomaly:${anomaly.category}:${anomaly.date}:${index}`,
      title: `Unusual ${anomaly.category} charge`,
      description: `${Number(anomaly.amount || 0).toLocaleString('en-IN')} on ${
        anomaly.date || 'an unrecorded date'
      }. Expected range ${anomaly.expected_range || 'not established'}. ${
        anomaly.reason || ''
      }`.trim(),
      impact: `₹${Number(anomaly.amount || 0).toLocaleString('en-IN')}`,
      suggestedAction: 'Verify the invoice or meter reading before approving.',
      time,
      type: 'danger',
      category: 'alerts',
      icon: '⚠️',
      targetPage: 'expenses',
    });
  });

  // A degraded response is a fact about the system, not a business event, but
  // the merchant still needs to know the numbers in front of them are the
  // seasonal-naive fallback rather than the trained model.
  if (insights?.degraded || expenses?.degraded) {
    notifications.push({
      id: 'system:degraded',
      title: 'ML service unavailable — showing fallback estimates',
      description:
        'The forecasting service did not respond, so these figures come from a ' +
        'seasonal-naive fallback rather than the trained models. Start the ML ' +
        'service to restore full predictions.',
      impact: 'Degraded',
      suggestedAction: 'Start the ML service, then refresh.',
      time,
      type: 'warning',
      category: 'alerts',
      icon: '🔌',
      targetPage: 'forecasting',
    });
  }

  errors.forEach((message, index) => {
    notifications.push({
      id: `system:feed-error:${index}`,
      title: 'Could not reach the forecasting service',
      description: message,
      impact: 'Unavailable',
      suggestedAction: 'Check that the backend and ML service are running.',
      time,
      type: 'warning',
      category: 'alerts',
      icon: '🔌',
      targetPage: 'forecasting',
    });
  });

  if (notifications.length === 0) {
    notifications.push({
      id: 'system:all-clear',
      title: 'No critical issues detected',
      description:
        'Every model ran against current data and raised no stockout, revenue ' +
        'or expense alert for this forecast window.',
      impact: 'All Clear',
      suggestedAction: '',
      time,
      type: 'success',
      category: 'updates',
      icon: '✅',
      targetPage: 'forecasting',
    });
  }

  return notifications;
}
