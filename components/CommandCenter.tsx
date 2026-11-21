
import { ArrowUpRight, Sparkles, Zap } from "lucide-react";

type CommandCenterProps = {
  total: number;
  completed: number;
  pending: number;
  onCreateTask: () => void;
};

export default function CommandCenter({
  total,
  completed,
  pending,
  onCreateTask,
}: CommandCenterProps) {
  const progress = total
    ? Math.round((completed / total) * 100)
    : 0;

  return (
    <section className="command-center">
      <div className="command-center__content">
        <div className="command-center__eyebrow">
          <Sparkles size={15} />
          TASKFLOW AI / COMMAND CENTER
        </div>

        <h2>
          Your next level of
          <span> productivity starts here.</span>
        </h2>

        <p>
          Organize your priorities, capture ideas instantly,
          and turn your goals into meaningful progress.
        </p>

        <div className="command-center__actions">
          <button
            type="button"
            className="button"
            onClick={onCreateTask}
          >
            <Zap size={17} />
            Create a task
            <ArrowUpRight size={16} />
          </button>

          <div className="command-center__status">
            <span className="command-center__status-dot" />
            SYSTEM ONLINE
          </div>
        </div>
      </div>

      <div className="command-center__progress">
        <div
          className="command-center__ring"
          style={{
            background: `conic-gradient(
              #a58cff ${progress}%,
              #293047 ${progress}% 100%
            )`,
          }}
        >
          <div className="command-center__ring-inner">
            <strong>{progress}%</strong>
            <span>COMPLETE</span>
          </div>
        </div>

        <div className="command-center__summary">
          <span>{completed} completed</span>
          <span>{pending} remaining</span>
        </div>
      </div>
    </section>
  );
}
