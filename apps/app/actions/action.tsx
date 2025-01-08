"use server";
import { ReactNode } from "react";
import { createStreamableValue, getMutableAIState, streamUI } from "ai/rsc";
import { togetherai } from "@ai-sdk/togetherai";
import { AI } from "@/lib/ai";
import { BotMessage } from "@/components/custom/onboarding/message";
import BeatLoader from "@/components/custom/onboarding/BeatLoader";
import { getSession, onboardingComplete } from "./session";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import Proceed from "@/components/custom/onboarding/proceed";
import WorkspaceForm from "@/components/custom/onboarding/workspace-form";
import { sleep } from "@/lib/utils";
import { CoreMessage, generateId, ToolInvocation } from "ai";
import ProjectForm from "@/components/custom/onboarding/project-form";
import { getFirstWorkspaceOfUser } from "./workspace";
import { getProjectOfUser } from "./project";

export type ServerMessage = {
  id?: number;
  name?: "should_continue" | "workspace_form" | "project_form";
  role: "user" | "assistant";
  content: string;
};

export type ClientMessage = {
  id: number;
  role: "user" | "assistant";
  display: ReactNode;
  content?: string;
  toolInvocations?: ToolInvocation[];
};

export interface AiPrompt {
  prompt: string;
}
export const sendMessage = async ({
  prompt,
}: AiPrompt): Promise<ClientMessage> => {
  const history = getMutableAIState<typeof AI>();
  history.update([...history.get(), { role: "user", content: prompt }]);
  const aiGreetingContext = await createAiGreeting();

  const response = await streamUI({
    model: togetherai("meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo"),
    system: `
    You are an onboarding assitand and you are helping users to onboard them to Plura AI.
    -any question not related to the onbaording should not be answered by you
    -if someone asks any message that is not related to the onboarding then you should respond with the exact same text "wlecome to Plura"
    - the first message from the user will be  "onboard me" you should always respond with the exact text-
    ${aiGreetingContext}.
    -No tools should be called for this
    -if the message comes as "should we continue" then call proceed tool
    The workflow is as follows:
    -User sends "yes" or "no" to proceed
    -If the user sends "yes" then the workflow is as follows:
    -then you call the workspace tool
    - If the user sends "no", respond with exactly: "please create a workspace to continue your onboarding".Do not call any tools for "no"
    - Only trigger the proceed tool when asking: "should we continue?"
    -If the user sends any message after workspace tool is called then you should respond with the same text:"Please create a workspace to continue"
    -dont call any tools if the user doesnt creates a workspace
    -If the message comes as workspace {workspaceName} created then respond with the exact same text
    "Your first workspace with name - ✅{workspaceName}  has been created"
    -if the messages comes as "call project form withe workspaceId:{workspaceId}" then call the project tool
    -If the message comes as  onbaordComplete then call the onboardComplete tool
    `,
    messages: [{ role: "user", content: prompt }, ...history.get()],
    temperature: 0,
    initial: (
      <BotMessage>
        <BeatLoader />
      </BotMessage>
    ),
    text: async function ({ content, done }) {
      await sleep(1000);
      if (done) {
        history.done([...history.get(), { role: "assistant", content }]);
      }

      return <BotMessage>{content}</BotMessage>;
    },
    tools: {
      workspace: {
        description:
          "a tool that sends the workspace form to the user.When the user responds with yes or when the user asks to create a workspace then this tool should be called",
        parameters: z.object({}),
        generate: async function* ({}) {
          yield (
            <BotMessage>
              <BeatLoader />
            </BotMessage>
          );

          history.done([
            ...history.get(),
            {
              role: "assistant",
              name: "workspace_form",
              content: "workspace form for the user has been sent",
            },
          ]);

          const workspace: any = await getFirstWorkspaceOfUser();

          const workspaceId = workspace?.data?.firstWorkspace?.id ?? " ";
          const exisitingWorkspaceName =
            workspace?.data?.firstWorkspace?.name ?? " ";
          return (
            <BotMessage>
              <WorkspaceForm
                workspaceExists={!!workspace}
                id={workspaceId}
                existingWorkspaceName={exisitingWorkspaceName}
              />
            </BotMessage>
          );
        },
      },
      project: {
        description:
          "A tool that sends the project form to the user after workspace creation.",
        parameters: z.object({
          workspaceId: z.string(),
        }),
        generate: async function* ({ workspaceId }) {
          yield (
            <BotMessage>
              <BeatLoader />
            </BotMessage>
          );
          console.log(workspaceId);
          await sleep(1000);
          history.done([
            ...history.get(),
            {
              role: "assistant",
              name: "project_form",
              content: "workspace form for the user has been sent",
            },
          ]);
          const existingProject: any = await getProjectOfUser(workspaceId);
          const exisitingProjectName = existingProject?.data?.name ?? " ";
          console.log(existingProject);
          return (
            <BotMessage>
              <ProjectForm
                workspaceId={workspaceId}
                projectExists={!!existingProject}
                existingProjectName={exisitingProjectName}
              />
            </BotMessage>
          );
        },
      },
      onboardComplete: {
        description: "a tool that is called after the onbaording is complete",
        parameters: z.object({}),
        generate: async function* ({}) {
          yield (
            <BotMessage>
              <p>Onboarding complete</p>
            </BotMessage>
          );

          await onboardingComplete();

          return (
            <BotMessage>
              Your onboarding has been completed! redirecting to the main page
            </BotMessage>
          );
        },
      },
      proceed: {
        description: `should we continue option that contains yes and no options`,
        parameters: z.object({}),
        generate: async function* ({}) {
          yield (
            <BotMessage>
              <BeatLoader />
            </BotMessage>
          );

          history.done([
            ...history.get(),
            {
              role: "assistant",
              name: "should_continue",
              content: "should be continue rendered",
            },
          ]);

          return (
            <BotMessage>
              <Proceed />
            </BotMessage>
          );
        },
      },
    },
  });

  return {
    id: Date.now(),
    role: "assistant" as const,
    display: response.value,
  };
};

export const createAiGreeting = async () => {
  const session = await getSession();
  if (!session || !("user" in session)) {
    return;
  }
  const { name, email } = session.user;
  const contentString = `
  Hi ${name}, welcome to Plura AI! 🎉👋

I'm your onboarding assistant, here to guide you through every step.
I see your email is ${email}.📧

Let’s make this journey smooth and fun! If you have any questions, I’m just a message away🚀.
Ready to dive in? Let’s go!🏄‍♂️
`.trim();

  return contentString;
};
