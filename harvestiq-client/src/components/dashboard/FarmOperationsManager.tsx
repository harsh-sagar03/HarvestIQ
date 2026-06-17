"use client";

import React, { useState } from "react";
import { 
  Sprout, 
  IndianRupee, 
  Trash2, 
  Edit2, 
  Plus, 
  Calendar, 
  Scale, 
  Coins, 
  Wallet, 
  Info,
  X
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  useExpenses, 
  useHarvests, 
  useCreateExpense, 
  useUpdateExpense, 
  useDeleteExpense, 
  useCreateHarvest, 
  useUpdateHarvest, 
  useDeleteHarvest 
} from "@/hooks/useFarmOperations";

export interface FarmOperationsManagerProps {
  farmId?: string | null;
  cycleId?: string | null;
  className?: string;
}

function ExpenseForm({ cycleId, expense, onCancel, onSuccess }: { cycleId: string; expense?: any; onCancel: () => void; onSuccess: () => void }) {
  const createMutation = useCreateExpense(cycleId);
  const updateMutation = useUpdateExpense(cycleId);
  
  const isEditing = Boolean(expense);
  const mutation = isEditing ? updateMutation : createMutation;
  
  const [form, setForm] = useState({
    category: expense?.category || "SEEDS",
    amount: expense?.amount?.toString() || "",
    notes: expense?.notes || "",
    expense_date: expense?.expense_date || new Date().toISOString().split("T")[0]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) return;
    
    const payload = {
      crop_cycle_id: cycleId,
      category: form.category,
      amount: parseFloat(form.amount),
      notes: form.notes || undefined,
      expense_date: form.expense_date
    };

    if (isEditing) {
      await updateMutation.mutateAsync({ id: expense.id, payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    onSuccess();
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3 mt-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h4 className="text-sm font-bold text-slate-800">{isEditing ? "Edit Expense" : "Add Expense"}</h4>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full" onClick={onCancel} type="button">
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            className="flex h-10 w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            <option value="SEEDS">Seeds</option>
            <option value="FERTILIZER">Fertilizer</option>
            <option value="PESTICIDES">Pesticides</option>
            <option value="IRRIGATION_FUEL">Irrigation / Fuel</option>
            <option value="LABOR">Labor</option>
            <option value="MACHINERY_RENT">Machinery Rent</option>
            <option value="TRANSPORT">Transport</option>
            <option value="LAND_RENT">Land Rent</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        
        <div className="space-y-1">
          <Label htmlFor="amount">Amount (INR)</Label>
          <Input 
            id="amount" 
            type="number" 
            min="0"
            step="any"
            value={form.amount} 
            onChange={(e) => setForm({ ...form, amount: e.target.value })} 
            required
            placeholder="Amount in Rupees"
          />
        </div>
        
        <div className="space-y-1">
          <Label htmlFor="expense_date">Date</Label>
          <Input 
            id="expense_date" 
            type="date" 
            value={form.expense_date} 
            onChange={(e) => setForm({ ...form, expense_date: e.target.value })} 
            required
          />
        </div>
        
        <div className="space-y-1">
          <Label htmlFor="notes">Notes</Label>
          <Input 
            id="notes" 
            type="text" 
            value={form.notes} 
            onChange={(e) => setForm({ ...form, notes: e.target.value })} 
            placeholder="Optional details"
          />
        </div>
      </div>
      
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onCancel} type="button">Cancel</Button>
        <Button size="sm" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : isEditing ? "Update" : "Save"}
        </Button>
      </div>
      
      {mutation.error instanceof Error && (
        <p className="text-xs text-rose-600 mt-1">{mutation.error.message}</p>
      )}
    </form>
  );
}

function HarvestForm({ cycleId, harvest, onCancel, onSuccess }: { cycleId: string; harvest?: any; onCancel: () => void; onSuccess: () => void }) {
  const createMutation = useCreateHarvest(cycleId);
  const updateMutation = useUpdateHarvest(cycleId);
  
  const isEditing = Boolean(harvest);
  const mutation = isEditing ? updateMutation : createMutation;
  
  const [form, setForm] = useState({
    yield_quantity: harvest?.yield_quantity?.toString() || "",
    yield_unit: harvest?.yield_unit || "Quintal",
    revenue: harvest?.revenue?.toString() || "",
    harvest_date: harvest?.harvest_date || new Date().toISOString().split("T")[0]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.yield_quantity || parseFloat(form.yield_quantity) <= 0) return;
    if (!form.revenue || parseFloat(form.revenue) < 0) return;
    
    const payload = {
      crop_cycle_id: cycleId,
      yield_quantity: parseFloat(form.yield_quantity),
      yield_unit: form.yield_unit,
      revenue: parseFloat(form.revenue),
      harvest_date: form.harvest_date
    };

    if (isEditing) {
      await updateMutation.mutateAsync({ id: harvest.id, payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    onSuccess();
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3 mt-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h4 className="text-sm font-bold text-slate-800">{isEditing ? "Edit Harvest Record" : "Add Harvest Record"}</h4>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full" onClick={onCancel} type="button">
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="yield_quantity">Yield Quantity</Label>
          <Input 
            id="yield_quantity" 
            type="number" 
            min="0"
            step="any"
            value={form.yield_quantity} 
            onChange={(e) => setForm({ ...form, yield_quantity: e.target.value })} 
            required
            placeholder="Quantity harvested"
          />
        </div>
        
        <div className="space-y-1">
          <Label htmlFor="yield_unit">Yield Unit</Label>
          <Input 
            id="yield_unit" 
            type="text" 
            value={form.yield_unit} 
            onChange={(e) => setForm({ ...form, yield_unit: e.target.value })} 
            required
            placeholder="e.g. Quintal, Kg, Bags"
          />
        </div>
        
        <div className="space-y-1">
          <Label htmlFor="revenue">Revenue (INR)</Label>
          <Input 
            id="revenue" 
            type="number" 
            min="0"
            step="any"
            value={form.revenue} 
            onChange={(e) => setForm({ ...form, revenue: e.target.value })} 
            required
            placeholder="Total sale amount"
          />
        </div>
        
        <div className="space-y-1">
          <Label htmlFor="harvest_date">Date</Label>
          <Input 
            id="harvest_date" 
            type="date" 
            value={form.harvest_date} 
            onChange={(e) => setForm({ ...form, harvest_date: e.target.value })} 
            required
          />
        </div>
      </div>
      
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onCancel} type="button">Cancel</Button>
        <Button size="sm" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : isEditing ? "Update" : "Save"}
        </Button>
      </div>
      
      {mutation.error instanceof Error && (
        <p className="text-xs text-rose-600 mt-1">{mutation.error.message}</p>
      )}
    </form>
  );
}

export function FarmOperationsManager({ farmId, cycleId, className }: FarmOperationsManagerProps) {
  const [addingExpense, setAddingExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);

  const [addingHarvest, setAddingHarvest] = useState(false);
  const [editingHarvest, setEditingHarvest] = useState<any>(null);

  const { data: expenses, isLoading: loadingExpenses, error: errorExpenses } = useExpenses(cycleId);
  const { data: harvests, isLoading: loadingHarvests, error: errorHarvests } = useHarvests(cycleId);

  const deleteExpenseMutation = useDeleteExpense(cycleId);
  const deleteHarvestMutation = useDeleteHarvest(cycleId);

  if (!cycleId) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Farm Operations</CardTitle>
          <CardDescription>Manage your daily crop cycle logs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
            Select or set up an active crop cycle to manage expenses and harvests.
          </div>
        </CardContent>
      </Card>
    );
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "SEEDS": return "Seeds";
      case "FERTILIZER": return "Fertilizer";
      case "PESTICIDES": return "Pesticides";
      case "IRRIGATION_FUEL": return "Irrigation / Fuel";
      case "LABOR": return "Labor";
      case "MACHINERY_RENT": return "Machinery Rent";
      case "TRANSPORT": return "Transport";
      case "LAND_RENT": return "Land Rent";
      default: return "Other";
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <p className="dashboard-section-title mb-1 flex items-center gap-1.5 text-slate-500 uppercase tracking-wider text-xs font-semibold">
            <Wallet className="h-3.5 w-3.5 text-emerald-600" />
            Operations Manager
          </p>
          <CardTitle className="text-lg font-bold text-slate-800">Farm Operations</CardTitle>
          <CardDescription>Record and manage financial transactions for the active crop cycle</CardDescription>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="expenses" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-4">
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="harvests">Harvests</TabsTrigger>
          </TabsList>
          
          <TabsContent value="expenses">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Crop Expenses</h3>
              {!addingExpense && !editingExpense && (
                <Button size="sm" className="h-8 gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white animate-fadeIn" onClick={() => setAddingExpense(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add Expense
                </Button>
              )}
            </div>

            {addingExpense && (
              <ExpenseForm 
                cycleId={cycleId} 
                onCancel={() => setAddingExpense(false)} 
                onSuccess={() => setAddingExpense(false)} 
              />
            )}

            {editingExpense && (
              <ExpenseForm 
                cycleId={cycleId} 
                expense={editingExpense} 
                onCancel={() => setEditingExpense(null)} 
                onSuccess={() => setEditingExpense(null)} 
              />
            )}

            {loadingExpenses ? (
              <div className="h-24 animate-pulse bg-slate-100 rounded-xl mt-3" />
            ) : errorExpenses ? (
              <div className="text-xs text-rose-600 mt-3 p-3 bg-rose-50/50 rounded-xl border border-rose-100">
                Failed to load expenses.
              </div>
            ) : !expenses || expenses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400 mt-3">
                No expenses logged yet. Add seeds, fertilizer, or labor costs to get started.
              </div>
            ) : (
              <div className="mt-3 space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {expenses.map((exp: any) => (
                  <div key={exp.id} className="flex items-center justify-between border border-slate-100 rounded-xl p-3 hover:bg-slate-50/50 transition-colors bg-white">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200/50">
                          {getCategoryLabel(exp.category)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {exp.expense_date}
                        </span>
                      </div>
                      {exp.notes && <p className="text-xs text-slate-500 font-medium">{exp.notes}</p>}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-800 flex items-center">
                        <IndianRupee className="h-3 w-3 text-slate-500" />
                        {exp.amount.toLocaleString("en-IN")}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900"
                          onClick={() => {
                            setEditingExpense(exp);
                            setAddingExpense(false);
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 rounded-lg hover:bg-rose-50 text-rose-600 hover:text-rose-700"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this expense?")) {
                              void deleteExpenseMutation.mutate(exp.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="harvests">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Crop Harvests</h3>
              {!addingHarvest && !editingHarvest && (
                <Button size="sm" className="h-8 gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white animate-fadeIn" onClick={() => setAddingHarvest(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add Harvest
                </Button>
              )}
            </div>

            {addingHarvest && (
              <HarvestForm 
                cycleId={cycleId} 
                onCancel={() => setAddingHarvest(false)} 
                onSuccess={() => setAddingHarvest(false)} 
              />
            )}

            {editingHarvest && (
              <HarvestForm 
                cycleId={cycleId} 
                harvest={editingHarvest} 
                onCancel={() => setEditingHarvest(null)} 
                onSuccess={() => setEditingHarvest(null)} 
              />
            )}

            {loadingHarvests ? (
              <div className="h-24 animate-pulse bg-slate-100 rounded-xl mt-3" />
            ) : errorHarvests ? (
              <div className="text-xs text-rose-600 mt-3 p-3 bg-rose-50/50 rounded-xl border border-rose-100">
                Failed to load harvests.
              </div>
            ) : !harvests || harvests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400 mt-3">
                No harvests logged yet. Record crop yield and revenue.
              </div>
            ) : (
              <div className="mt-3 space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {harvests.map((harv: any) => (
                  <div key={harv.id} className="flex items-center justify-between border border-slate-100 rounded-xl p-3 hover:bg-slate-50/50 transition-colors bg-white">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-emerald-800 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100/50 flex items-center gap-1">
                          <Scale className="h-3 w-3 text-emerald-600" />
                          {harv.yield_quantity} {harv.yield_unit}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {harv.harvest_date}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-sm font-bold text-slate-800 flex items-center justify-end">
                          <IndianRupee className="h-3 w-3 text-slate-500" />
                          {harv.revenue.toLocaleString("en-IN")}
                        </span>
                        <span className="text-[9px] text-slate-400 block font-medium">Revenue generated</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900"
                          onClick={() => {
                            setEditingHarvest(harv);
                            setAddingHarvest(false);
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 rounded-lg hover:bg-rose-50 text-rose-600 hover:text-rose-700"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this harvest record?")) {
                              void deleteHarvestMutation.mutate(harv.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
