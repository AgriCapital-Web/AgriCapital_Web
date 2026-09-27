import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const Notifications = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, refetch } = useNotifications();

  return (
    <MainLayout>
      <div className="w-full min-w-0 space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold sm:text-3xl">Notifications</h1>
            <p className="mt-1 text-sm text-muted-foreground">Retrouvez les informations et alertes liées à votre compte AgriCapital.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void refetch()}><RefreshCw className="mr-2 h-4 w-4" />Actualiser</Button>
            {unreadCount > 0 && <Button onClick={() => void markAllAsRead()}><CheckCheck className="mr-2 h-4 w-4" />Tout marquer comme lu</Button>}
          </div>
        </div>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2"><Bell className="h-5 w-5" />Toutes les notifications {unreadCount > 0 && <Badge variant="destructive">{unreadCount} non lue(s)</Badge>}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {notifications.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">Aucune notification pour le moment.</div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <button key={notification.id} type="button" onClick={() => !notification.read && void markAsRead(notification.id)}
                    className={`block w-full min-w-0 p-4 text-left transition-colors hover:bg-muted/50 sm:p-5 ${!notification.read ? "bg-primary/5" : ""}`}>
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${!notification.read ? "bg-primary" : "bg-muted"}`} />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="break-anywhere font-medium">{notification.title}</p>
                        <p className="break-anywhere text-sm text-muted-foreground">{notification.message}</p>
                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: fr })}</p>
                      </div>
                      {!notification.read && <Badge className="shrink-0">Nouveau</Badge>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Notifications;
