import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "active" | "inactive" | "pending" | "approved" | "rejected" | "free" | "pro" | "upcoming";
}

const statusStyles: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  upcoming: "bg-primary/10 text-primary border-primary/20",
  inactive: "bg-muted text-muted-foreground border-border",
  pending: "bg-warning/10 text-warning border-warning/20",
  approved: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  free: "bg-muted text-muted-foreground border-border",
  pro: "bg-primary/10 text-primary border-primary/20",
};

const StatusBadge = ({ status }: StatusBadgeProps) => {
  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize font-medium text-xs",
        statusStyles[status] || statusStyles.inactive
      )}
    >
      {status}
    </Badge>
  );
};

export default StatusBadge;
