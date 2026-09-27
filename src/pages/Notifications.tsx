import MainLayout from "@/components/layout/MainLayout";
import { useNotifications } from "@/hooks/useNotifications";

const Notifications = () => {
  const { notifications, unreadCount, markAsRead } = useNotifications();

  return (
    <MainLayout>
      <div className="w-full min-w-0 space-y-4 p-3 sm:space-y-6 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">{unreadCount} notification(s) non lue(s).</p>
        </div>
        <div className="overflow-hidden rounded-lg border bg-card">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Aucune notification pour le moment.</div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className="block w-full min-w-0 p-4 text-left hover:bg-muted/50"
                  onClick={() => !notification.read && void markAsRead(notification.id)}
                >
                  <div className="min-w-0">
                    <p className="break-anywhere font-medium">{notification.title}</p>
                    <p className="mt-1 break-anywhere text-sm text-muted-foreground">{notification.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{new Date(notification.created_at).toLocaleString("fr-FR")}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Notifications;
