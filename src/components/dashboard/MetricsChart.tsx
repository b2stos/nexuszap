import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export function MetricsChart() {
  const { data: chartData } = useQuery({
    queryKey: ["metrics-chart"],
    queryFn: async () => {
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date.toISOString().split("T")[0];
      });

      const data = await Promise.all(
        last7Days.map(async (date) => {
          const nextDate = new Date(date);
          nextDate.setDate(nextDate.getDate() + 1);

          const { data: sent } = await supabase
            .from("messages")
            .select("id", { count: "exact" })
            .gte("created_at", date)
            .lt("created_at", nextDate.toISOString().split("T")[0])
            .in("status", ["sent", "delivered", "read"]);

          const { data: delivered } = await supabase
            .from("messages")
            .select("id", { count: "exact" })
            .gte("delivered_at", date)
            .lt("delivered_at", nextDate.toISOString().split("T")[0]);

          const { data: read } = await supabase
            .from("messages")
            .select("id", { count: "exact" })
            .gte("read_at", date)
            .lt("read_at", nextDate.toISOString().split("T")[0]);

          return {
            date: new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
            enviadas: sent?.length || 0,
            entregues: delivered?.length || 0,
            visualizadas: read?.length || 0,
          };
        })
      );

      return data;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução das Mensagens</CardTitle>
        <CardDescription>Últimos 7 dias</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData || []}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="enviadas"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              name="Enviadas"
            />
            <Line
              type="monotone"
              dataKey="entregues"
              stroke="hsl(142, 76%, 36%)"
              strokeWidth={2}
              name="Entregues"
            />
            <Line
              type="monotone"
              dataKey="visualizadas"
              stroke="hsl(24, 96%, 53%)"
              strokeWidth={2}
              name="Visualizadas"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
