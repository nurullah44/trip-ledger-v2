import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { groupQueryKey, ledgerService, LedgerError } from "@/services";
import type { ExpenseInput, GroupSnapshot, RepaymentInput } from "@/domain/types";

/**
 * True once mounted in the browser. The mock service reads localStorage, which
 * only exists client-side, so group queries stay disabled during SSR / first
 * paint to avoid hydration mismatches and spurious "not found" throws.
 */
export function useIsClient(): boolean {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  return isClient;
}

export function useGroup(token: string) {
  const isClient = useIsClient();
  return useQuery({
    queryKey: groupQueryKey(token),
    queryFn: () => ledgerService.getGroupByToken(token),
    enabled: isClient && token.length > 0,
    retry: false,
    staleTime: 0,
  });
}

/**
 * Wraps the mutating service calls. Each ledger mutation returns the fresh
 * snapshot, so we write it straight into the cache — no refetch needed.
 */
export function useGroupMutations(token: string) {
  const queryClient = useQueryClient();
  const put = (snapshot: GroupSnapshot) => queryClient.setQueryData(groupQueryKey(token), snapshot);

  const addParticipant = useMutation({
    mutationFn: (name: string) => ledgerService.addParticipant(token, name),
    onSuccess: put,
  });
  const renameParticipant = useMutation({
    mutationFn: (vars: { participantId: string; name: string }) =>
      ledgerService.renameParticipant(token, vars.participantId, vars.name),
    onSuccess: put,
  });
  const createExpense = useMutation({
    mutationFn: (input: ExpenseInput) => ledgerService.createExpense(token, input),
    onSuccess: put,
  });
  const updateExpense = useMutation({
    mutationFn: (vars: { expenseId: string; input: ExpenseInput }) =>
      ledgerService.updateExpense(token, vars.expenseId, vars.input),
    onSuccess: put,
  });
  const deleteExpense = useMutation({
    mutationFn: (expenseId: string) => ledgerService.deleteExpense(token, expenseId),
    onSuccess: put,
  });
  const createRepayment = useMutation({
    mutationFn: (input: RepaymentInput) => ledgerService.createRepayment(token, input),
    onSuccess: put,
  });
  const finishGroup = useMutation({
    mutationFn: () => ledgerService.finishGroup(token),
    onSuccess: put,
  });
  const reopenGroup = useMutation({
    mutationFn: () => ledgerService.reopenGroup(token),
    onSuccess: put,
  });
  const deleteGroup = useMutation({
    mutationFn: () => ledgerService.deleteGroup(token),
  });

  return {
    addParticipant,
    renameParticipant,
    createExpense,
    updateExpense,
    deleteExpense,
    createRepayment,
    finishGroup,
    reopenGroup,
    deleteGroup,
  };
}

export function ledgerErrorMessage(error: unknown): string {
  if (error instanceof LedgerError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}
