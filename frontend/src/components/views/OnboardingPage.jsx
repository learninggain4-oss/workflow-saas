import React, { useCallback, useEffect, useState } from 'react';
import { onboarding as onboardingApi } from '../../services/api';

// The server sends state only (done + counts). Titles, descriptions, and where
// each step's button navigates live here, because this component owns the
// view-id enum and the translation bundles. Keeping the two apart is what lets
// the page be translated without touching the API.
const STEP_META = {
  create_project: { title: 'Create your workspace', detail: 'Name your first project so the team has somewhere to work.', cta: 'New project', view: 'board' },
  start_from_template: { title: 'Start from a template', detail: 'Kick off a project from a ready-made template with tasks included.', cta: 'Browse templates', view: 'templates' },
  create_first_task: { title: 'Create your first task', detail: 'Add a task to a project and assign it an owner.', cta: 'Open a board', view: 'board' },
  invite_teammate: { title: 'Invite a teammate', detail: 'Bring someone in and give them a role on your project.', cta: 'Invite people', view: 'team' },
  add_automation: { title: 'Set an automation rule', detail: 'Automate reminders and status changes so nothing slips.', cta: 'Add a rule', view: 'automations' },
  enable_two_factor: { title: 'Protect your account', detail: 'Turn on two-factor authentication for an extra layer of security.', cta: 'Account settings', view: 'settings' },
  email_notifications: { title: 'Email notifications', detail: 'Know when someone assigns or updates your work.', cta: 'Account settings', view: 'settings' },
  weekly_digest: { title: 'Weekly digest', detail: 'Get one summary of the week instead of constant pings.', cta: 'Account settings', view: 'settings' },
};

const STEP_ORDER = Object.keys(STEP_META);

const GROUP_META = {
  setup: { title: 'Set up your workspace' },
  account: { title: 'Secure your account' },
};

const GROUP_OF = {
  create_project: 'setup',
  start_from_template: 'setup',
  create_first_task: 'setup',
  invite_teammate: 'setup',
  add_automation: 'setup',
  enable_two_factor: 'account',
  email_notifications: 'account',
  weekly_digest: 'account',
};

export default function OnboardingPage({ bgCard, setViewMode, t }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await onboardingApi.get();
      setData(res.data);
    } catch (e) {
      // Never fall back to placeholder numbers: a fake 72% is worse than an
      // honest error, because it looks like real progress.
      setError(t('Could not load your setup progress.'));
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const stepsByKey = new Map((data?.steps || []).map((s) => [s.key, s]));
  const isDone = (key) => Boolean(stepsByKey.get(key)?.done);

  const groups = Object.keys(GROUP_META)
    .map((groupKey) => ({
      key: groupKey,
      title: t(GROUP_META[groupKey].title),
      steps: STEP_ORDER.filter((key) => GROUP_OF[key] === groupKey).map((key) => {
        const state = stepsByKey.get(key);
        const meta = STEP_META[key];
        return {
          key,
          title: t(meta.title),
          detail: t(meta.detail),
          cta: t(meta.cta),
          view: meta.view,
          done: Boolean(state?.done),
          // Only show a count when the server sent one; inventing "0 of 1"
          // for preference steps would imply a target that does not exist.
          count: state?.count ?? null,
          target: state?.target ?? null,
        };
      }),
    }))
    .filter((group) => group.steps.length > 0);

  const nextStep = groups.flatMap((g) => g.steps).find((s) => !s.done) || null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-2">
      <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">{t('Onboarding')}</p>
            <h2 className="mt-2 text-2xl font-bold">
              {loading ? t('Checking your setup...') : t('Set up your workflow in under 10 minutes')}
            </h2>
            {!loading && !error && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {t('{{done}} of {{total}} steps done', { done: data?.completed ?? 0, total: data?.total ?? 0 })}
                {' · '}
                {t('{{projects}} projects, {{tasks}} tasks', { projects: data?.projects ?? 0, tasks: data?.tasks ?? 0 })}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-3">
            <button
              type="button"
              onClick={() => setViewMode('dashboard')}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-200 dark:hover:text-indigo-400"
            >
              {t('Dashboard')}
            </button>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? t('Refreshing...') : t('Refresh progress')}
            </button>
          </div>
        </div>

        {!loading && !error && data && (
          <div className="mt-5">
            <div
              role="progressbar"
              aria-valuenow={data.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('Setup progress')}
              className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-500"
                style={{ width: `${data.percent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{t('{{percent}}% complete', { percent: data.percent })}</span>
              {nextStep ? (
                <button
                  type="button"
                  onClick={() => setViewMode(nextStep.view)}
                  className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  {t('Next: {{step}}', { step: nextStep.title })}
                </button>
              ) : (
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {t('All set! Your workspace is fully set up.')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <span>{error}</span>
          <button
            type="button"
            onClick={load}
            className="shrink-0 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300"
          >
            {t('Retry')}
          </button>
        </div>
      )}

      {loading && (
        <div className={`rounded-2xl border p-10 text-center shadow-sm ${bgCard}`}>
          <p className="text-sm text-gray-500">{t('Loading your progress...')}</p>
        </div>
      )}

      {!loading && !error && data && (
        <div className="grid gap-6 xl:grid-cols-2">
          {groups.map((group) => {
            const doneCount = group.steps.filter((s) => s.done).length;
            return (
              <div key={group.key} className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold">{group.title}</h3>
                  <span className="shrink-0 text-xs uppercase tracking-[0.2em] text-gray-500">
                    {t('{{done}}/{{total}}', { done: doneCount, total: group.steps.length })}
                  </span>
                </div>

                <div className="space-y-4">
                  {group.steps.map((step) => (
                    <div
                      key={step.key}
                      className={`rounded-2xl border p-4 ${step.done ? 'border-emerald-200 dark:border-emerald-900/60' : 'border-gray-200 dark:border-gray-800'}`}
                    >
                      <div className="flex gap-4">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold ${
                            step.done
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                              : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400'
                          }`}
                        >
                          {step.done ? (
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span aria-hidden="true">{group.steps.indexOf(step) + 1}</span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-base font-bold">
                              {step.title}
                              {step.done && <span className="sr-only">{t('Completed')}</span>}
                            </p>
                            <span
                              className={`inline-flex w-fit shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                                step.done
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                              }`}
                            >
                              {step.done ? t('Completed') : t('Not started')}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{step.detail}</p>

                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            {step.count !== null && step.target !== null && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {t('{{count}}/{{target}}', { count: step.count, target: step.target })}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setViewMode(step.view)}
                              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-indigo-700"
                            >
                              {step.cta}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
