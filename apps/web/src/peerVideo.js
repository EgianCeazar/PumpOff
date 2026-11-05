// Live video between the two players, sent directly phone to phone
// (WebRTC), so no server carries or stores it. The setup messages travel
// over the room link. If a direct connection can't be made (some strict
// networks), the battle still works: scores go over the room link too.
//
// Uses the "perfect negotiation" pattern: either side may start or
// restart the connection, and the polite side gives way on a clash.

const ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];

export function createPeerVideo({ polite, sendSignal, onRemoteStream, onState }) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  let makingOffer = false;
  let ignoreOffer = false;
  let closed = false;

  pc.ontrack = ({ streams }) => {
    if (streams[0]) onRemoteStream(streams[0]);
  };
  pc.onicecandidate = ({ candidate }) => {
    if (candidate) sendSignal({ candidate: candidate.toJSON() });
  };
  pc.onconnectionstatechange = () => onState(pc.connectionState);
  pc.onnegotiationneeded = async () => {
    try {
      makingOffer = true;
      await pc.setLocalDescription();
      sendSignal({ description: pc.localDescription.toJSON() });
    } catch (error) {
      console.warn('Video offer failed', error);
    } finally {
      makingOffer = false;
    }
  };

  async function handleSignal(data) {
    if (closed || !data) return;
    try {
      if (data.description) {
        const offerCollision =
          data.description.type === 'offer' && (makingOffer || pc.signalingState !== 'stable');
        ignoreOffer = !polite && offerCollision;
        if (ignoreOffer) return;
        await pc.setRemoteDescription(data.description);
        if (data.description.type === 'offer') {
          await pc.setLocalDescription();
          sendSignal({ description: pc.localDescription.toJSON() });
        }
      } else if (data.candidate) {
        try {
          await pc.addIceCandidate(data.candidate);
        } catch (error) {
          if (!ignoreOffer) throw error;
        }
      }
    } catch (error) {
      console.warn('Video setup message failed', error);
    }
  }

  // Sends this camera (or a new one after a switch); null stops sending.
  function setLocalStream(stream) {
    if (closed) return;
    const track = stream?.getVideoTracks()[0] ?? null;
    const sender = pc.getSenders().find(item => item.track?.kind === 'video' || item.track === null);
    if (sender) {
      sender.replaceTrack(track).catch(error => console.warn('Video track swap failed', error));
    } else if (track) {
      pc.addTrack(track, stream);
    }
  }

  return {
    handleSignal,
    setLocalStream,
    close() {
      closed = true;
      pc.close();
    },
  };
}
