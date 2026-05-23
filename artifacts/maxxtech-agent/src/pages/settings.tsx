import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Terminal, MonitorSmartphone, Sun, Moon, Cpu, Wrench } from "lucide-react";

const settingsSchema = z.object({
  agentName: z.string().min(1, "Agent name is required"),
  model: z.string(),
  systemPrompt: z.string(),
  enableCodeExecution: z.boolean(),
  enableWebSearch: z.boolean(),
  maxTokens: z.number().min(100).max(128000),
  temperature: z.number().min(0).max(2),
  theme: z.enum(["light", "dark", "system"]),
});

type SettingsValues = z.infer<typeof settingsSchema>;

export function SettingsPage() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useGetSettings({
    query: { queryKey: ['/api/settings'] }
  });
  
  const updateSettings = useUpdateSettings();
  const [activeTab, setActiveTab] = useState("general");

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      agentName: "MaxxTech Agent",
      model: "claude-3-5-sonnet",
      systemPrompt: "You are MaxxTech Agent, a highly capable technical assistant.",
      enableCodeExecution: true,
      enableWebSearch: true,
      maxTokens: 4096,
      temperature: 0.7,
      theme: "dark",
    }
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        agentName: settings.agentName,
        model: settings.model,
        systemPrompt: settings.systemPrompt,
        enableCodeExecution: settings.enableCodeExecution,
        enableWebSearch: settings.enableWebSearch,
        maxTokens: settings.maxTokens || 4096,
        temperature: settings.temperature || 0.7,
        theme: settings.theme,
      });
    }
  }, [settings, form]);

  const onSubmit = async (data: SettingsValues) => {
    try {
      await updateSettings.mutateAsync({ data });
      toast({
        title: "Settings saved",
        description: "Your preferences have been updated successfully.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to save settings.",
        variant: "destructive"
      });
    }
  };

  const tabs = [
    { id: "general", label: "General", icon: SettingsIcon },
    { id: "model", label: "Model & Prompts", icon: Cpu },
    { id: "tools", label: "Tools", icon: Wrench },
    { id: "appearance", label: "Appearance", icon: MonitorSmartphone },
  ];

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <span className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          Loading settings...
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full max-w-6xl mx-auto overflow-hidden bg-background">
      {/* Settings Nav */}
      <div className="w-64 border-r border-border bg-card/30 p-6 hidden md:block">
        <h2 className="text-lg font-bold mb-6 font-mono tracking-tight flex items-center gap-2">
          <Terminal className="w-5 h-5 text-primary" />
          Agent Config
        </h2>
        <nav className="space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.id 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? "text-primary" : "text-muted-foreground"}`} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-2xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              {activeTab === "general" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h3 className="text-xl font-bold mb-1">General Settings</h3>
                    <p className="text-sm text-muted-foreground mb-6">Core identity of your MaxxTech Agent.</p>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="agentName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agent Name</FormLabel>
                        <FormControl>
                          <Input {...field} className="font-mono" />
                        </FormControl>
                        <FormDescription>The name displayed in the interface.</FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {activeTab === "model" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h3 className="text-xl font-bold mb-1">Model & Prompts</h3>
                    <p className="text-sm text-muted-foreground mb-6">Configure the AI engine driving the agent.</p>
                  </div>

                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Model</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="font-mono">
                              <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
                            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                            <SelectItem value="gemini-1-5-pro">Gemini 1.5 Pro</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="systemPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>System Prompt</FormLabel>
                        <FormControl>
                          <Textarea {...field} className="h-40 font-mono text-sm" />
                        </FormControl>
                        <FormDescription>The foundational instructions guiding the agent's behavior.</FormDescription>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-8 pt-4">
                    <FormField
                      control={form.control}
                      name="temperature"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex justify-between">
                            <span>Temperature</span>
                            <span className="text-muted-foreground font-mono">{field.value}</span>
                          </FormLabel>
                          <FormControl>
                            <Slider 
                              min={0} max={2} step={0.1} 
                              value={[field.value]} 
                              onValueChange={(v) => field.onChange(v[0])} 
                              className="py-2"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="maxTokens"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex justify-between">
                            <span>Max Tokens</span>
                            <span className="text-muted-foreground font-mono">{field.value}</span>
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={e => field.onChange(parseInt(e.target.value, 10))}
                              className="font-mono"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {activeTab === "tools" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h3 className="text-xl font-bold mb-1">Tools & Capabilities</h3>
                    <p className="text-sm text-muted-foreground mb-6">Manage what your agent is allowed to do.</p>
                  </div>

                  <FormField
                    control={form.control}
                    name="enableCodeExecution"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4 bg-card/50">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Code Execution</FormLabel>
                          <FormDescription>
                            Allow the agent to write and run code in an isolated sandbox.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="enableWebSearch"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4 bg-card/50">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Web Search</FormLabel>
                          <FormDescription>
                            Allow the agent to search the internet for up-to-date information.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {activeTab === "appearance" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h3 className="text-xl font-bold mb-1">Appearance</h3>
                    <p className="text-sm text-muted-foreground mb-6">Customize the look and feel.</p>
                  </div>

                  <FormField
                    control={form.control}
                    name="theme"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Theme Preference</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select theme" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="light">
                              <div className="flex items-center gap-2"><Sun className="w-4 h-4"/> Light</div>
                            </SelectItem>
                            <SelectItem value="dark">
                              <div className="flex items-center gap-2"><Moon className="w-4 h-4"/> Dark</div>
                            </SelectItem>
                            <SelectItem value="system">
                              <div className="flex items-center gap-2"><MonitorSmartphone className="w-4 h-4"/> System Default</div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>MaxxTech Agent looks best in dark mode.</FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <div className="pt-6 border-t border-border flex justify-end">
                <Button 
                  type="submit" 
                  disabled={updateSettings.isPending}
                  className="w-full md:w-auto min-w-[120px]"
                >
                  {updateSettings.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
