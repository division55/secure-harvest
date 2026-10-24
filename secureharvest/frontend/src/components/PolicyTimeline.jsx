import React, { useEffect, useState } from 'react';

export default function PolicyTimeline({ policyId }) {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`/api/policies/${policyId}/timeline`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load policy history.');
        if (active) setEvents(data.events || []);
      })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [policyId]);

  return (
    <div className="policy-timeline">
      <h4>Policy activity</h4>
      {error ? <p className="field-help">{error}</p> : events.length === 0 ? <p className="field-help">No activity has been recorded yet.</p> : (
        <ol>
          {events.map((event) => (
            <li key={event.id}>
              <span className={`policy-timeline-dot event-${event.eventType}`} />
              <div><strong>{event.title}</strong>{event.details && <p>{event.details}</p>}<time>{new Date(`${event.createdAt.replace(' ', 'T')}Z`).toLocaleString()}</time></div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
