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
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="text-2xl">Evolução das Mensagens</CardTitle>
        <CardDescription>Últimos 7 dias</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData || []}>
            <defs>
              <linearGradient id="colorEnviadas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(228, 100%, 55%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(228, 100%, 55%)" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorEntregues" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorVisualizadas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(24, 96%, 53%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(24, 96%, 53%)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
            <XAxis 
              dataKey="date" 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
                boxShadow: "0 4px 12px hsl(var(--primary) / 0.1)",
              }}
            />
            <Legend 
              wrapperStyle={{
                paddingTop: "20px",
              }}
            />
            <Line
              type="monotone"
              dataKey="enviadas"
              stroke="hsl(228, 100%, 55%)"
              strokeWidth={3}
              name="Enviadas"
              dot={{ fill: "hsl(228, 100%, 55%)", r: 5 }}
              activeDot={{ r: 7 }}
              fill="url(#colorEnviadas)"
            />
            <Line
              type="monotone"
              dataKey="entregues"
              stroke="hsl(142, 76%, 36%)"
              strokeWidth={3}
              name="Entregues"
              dot={{ fill: "hsl(142, 76%, 36%)", r: 5 }}
              activeDot={{ r: 7 }}
              fill="url(#colorEntregues)"
            />
            <Line
              type="monotone"
              dataKey="visualizadas"
              stroke="hsl(24, 96%, 53%)"
              strokeWidth={3}
              name="Visualizadas"
              dot={{ fill: "hsl(24, 96%, 53%)", r: 5 }}
              activeDot={{ r: 7 }}
              fill="url(#colorVisualizadas)"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
