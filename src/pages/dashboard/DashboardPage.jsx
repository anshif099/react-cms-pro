import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { 
  Globe, 
  ShieldCheck, 
  Clock, 
  Terminal, 
  PlusCircle, 
  Activity, 
  Settings,
  ArrowRight,
  User
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useWebsites } from "../../hooks/useWebsites";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { StatCard } from "../../components/ui/StatCard";
import { Table, TableRow, TableCell } from "../../components/ui/Table";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";
import activityLogService from "../../services/activityLogService";

const getActivityIcon = (type) => {
  switch (type) {
    case "website_added":
      return { icon: PlusCircle, color: "text-blue-500 bg-blue-50 dark:bg-blue-950/20" };
    case "website_verified":
      return { icon: ShieldCheck, color: "text-green-500 bg-green-50 dark:bg-green-950/20" };
    case "api_key_regenerated":
    case "secret_key_regenerated":
      return { icon: Settings, color: "text-orange-500 bg-orange-50 dark:bg-orange-950/20" };
    case "profile_updated":
    case "settings_updated":
      return { icon: User, color: "text-purple-500 bg-purple-50 dark:bg-purple-950/20" };
    case "website_deleted":
      return { icon: Clock, color: "text-red-500 bg-red-50 dark:bg-red-950/20" };
    default:
      return { icon: Activity, color: "text-slate-500 bg-slate-50 dark:bg-slate-950/20" };
  }
};

export function DashboardPage() {
  const { user } = useAuth();
  const { websites } = useWebsites();
  const navigate = useNavigate();

  const [recentActivity, setRecentActivity] = useState([]);
  const [totalActivityCount, setTotalActivityCount] = useState(0);

  useEffect(() => {
    async function fetchActivityData() {
      try {
        const logs = await activityLogService.getRecentLogs(4);
        setRecentActivity(logs);
        const count = await activityLogService.getTotalLogsCount();
        setTotalActivityCount(count);
      } catch (error) {
        console.error("Error fetching dashboard activity data:", error);
      }
    }
    fetchActivityData();
  }, []);

  // Metrics
  const connectedCount = websites.filter(w => w.status === "connected").length;
  const pendingVerifyCount = websites.filter(w => w.verificationStatus === "pending" || w.verificationStatus === "unverified").length;
  const verifiedCount = websites.filter(w => w.verificationStatus === "verified").length;

  const recentWebsites = [...websites]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "connected": return "success";
      case "pending": return "warning";
      case "disconnected": return "neutral";
      default: return "neutral";
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8 text-left"
    >
      {/* Header welcome */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-admin-text tracking-tight">
            Welcome back, {user?.name || "Admin"}
          </h2>
          <p className="text-sm text-admin-secondary">
            Manage, verify, and monitor your connected websites from one dashboard.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => navigate("/websites/add")} variant="primary" className="gap-2">
            <PlusCircle className="w-4 h-4" />
            Connect Website
          </Button>
        </div>
      </motion.div>

      {/* Stat Cards Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Connected Websites"
          value={connectedCount}
          icon={Globe}
          description="active SDK connections"
        />
        <StatCard
          title="Pending Verification"
          value={pendingVerifyCount}
          icon={Clock}
          description="awaiting TXT/Meta verification"
        />
        <StatCard
          title="Verified Domains"
          value={verifiedCount}
          icon={ShieldCheck}
          description="verified successfully"
        />
        <StatCard
          title="Total Activity"
          value={totalActivityCount}
          icon={Activity}
          description="logged events"
        />
      </motion.div>

      {/* Main Grid: Recent + Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Websites List */}
        <motion.div variants={itemVariants} className="lg:col-span-2 space-y-4">
          <Card 
            title="Recent Connected Websites" 
            subtitle="The latest domains connected to ReactCMS Pro"
            headerAction={
              <Link to="/websites" className="text-xs font-semibold text-primary flex items-center hover:underline">
                View All Websites
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            }
            noPadding
          >
            {recentWebsites.length === 0 ? (
              <div className="p-8 text-center text-admin-secondary text-sm">
                No websites connected yet. Get started by connecting one.
              </div>
            ) : (
              <Table headers={[
                { label: "Website" },
                { label: "Framework" },
                { label: "Status" },
                { label: "Actions", className: "text-right" }
              ]}>
                {recentWebsites.map((web) => (
                  <TableRow key={web.id} onClick={() => navigate(`/websites/${web.id}`)}>
                    <TableCell>
                      <div className="font-semibold text-admin-text">{web.name}</div>
                      <div className="text-xs text-admin-secondary">{web.domain}</div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs bg-slate-100 dark:bg-slate-800 py-1 px-2.5 rounded-md font-medium text-admin-text">
                        {web.framework}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(web.status)}>{web.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/websites/${web.id}`);
                        }}
                      >
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
            )}
          </Card>
        </motion.div>

        {/* Side Panel: Quick Actions & Recent Activity */}
        <motion.div variants={itemVariants} className="space-y-8">
          {/* Quick Actions */}
          <Card title="Quick Actions">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/websites/add")}
                className="flex-col gap-2 p-4 h-auto text-center"
              >
                <PlusCircle className="w-5 h-5" />
                <span>Connect Domain</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(websites[0] ? `/websites/${websites[0].id}/sdk` : "/websites")}
                className="flex-col gap-2 p-4 h-auto text-center"
              >
                <Terminal className="w-5 h-5" />
                <span>Install SDK</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/profile")}
                className="flex-col gap-2 p-4 h-auto text-center"
              >
                <User className="w-5 h-5" />
                <span>My Profile</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/settings")}
                className="flex-col gap-2 p-4 h-auto text-center"
              >
                <Settings className="w-5 h-5" />
                <span>CMS Settings</span>
              </Button>
            </div>
          </Card>

          {/* Recent Activity */}
          <Card title="Recent Activity" headerAction={<Activity className="w-4 h-4 text-admin-secondary" />}>
            <div className="flow-root">
              {recentActivity.length === 0 ? (
                <div className="text-center py-6 text-xs text-admin-secondary">
                  No recent activity.
                </div>
              ) : (
                <ul className="-mb-8">
                  {recentActivity.map((act, idx) => {
                    const { icon: ActIcon, color: iconColor } = getActivityIcon(act.type);
                    return (
                      <li key={act.id}>
                        <div className="relative pb-8">
                          {idx !== recentActivity.length - 1 && (
                            <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-admin-border dark:bg-slate-800" aria-hidden="true" />
                          )}
                          <div className="relative flex space-x-3">
                            <div>
                              <span className={cn("h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white dark:ring-slate-900", iconColor)}>
                                <ActIcon className="w-4 h-4" aria-hidden="true" />
                              </span>
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <p className="text-xs font-semibold text-admin-text">{act.title}</p>
                              <p className="text-[10px] text-admin-secondary mt-0.5">{act.description}</p>
                            </div>
                            <div className="text-right text-[10px] whitespace-nowrap text-admin-secondary">
                              <time>{act.formattedTime}</time>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default DashboardPage;
