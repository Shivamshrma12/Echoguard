import asyncio
import logging
import os
from dotenv import load_dotenv
from livekit.agents import WorkerOptions, cli, JobContext, AutoSubscribe
from agent.state.generation_fence import GenerationFence
from agent.events.event_recorder import EventRecorder
from agent.incidents.incident_engine import IncidentEngine
from agent.rime_provider import RimeProviderService
from agent.voice_agent import EchoGuardVoiceAgent

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("echoguard.worker")

# Shared singletons for local development & bridge
recorder = EventRecorder()
fence = GenerationFence(recorder, initial_gen=14)
incidents = IncidentEngine(recorder)
rime_service = RimeProviderService()
voice_agent = EchoGuardVoiceAgent(fence, recorder, incidents, rime_service)

async def entrypoint(ctx: JobContext):
    logger.info(f"Connecting to room: {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    
    # Initialize Rime TTS plugin
    rime_tts = rime_service.create_livekit_tts()
    if rime_tts:
        logger.info(f"Using Rime TTS ({rime_service.model}/{rime_service.speaker}) via WebSocket")
    else:
        logger.warning(f"Rime TTS not initialized: {rime_service.probe_error}")
        
    await voice_agent.start()
    
    # Listen to participant events & interruptions
    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track, publication, participant):
        logger.info(f"Track subscribed from participant {participant.identity}")

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
