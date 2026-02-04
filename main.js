function getRecruitment(isRight, targetYaw, targetPitch) {
  const side = isRight ? 'right' : 'left';
  const prefix = isRight ? 'R-' : 'L-';
  const h = {
    LR: SYSTEM_STATE.nerves[prefix+'CN6'] * SYSTEM_STATE.muscles[side].LR,
    MR: SYSTEM_STATE.nerves[prefix+'CN3'] * SYSTEM_STATE.muscles[side].MR,
    SR: SYSTEM_STATE.nerves[prefix+'CN3'] * SYSTEM_STATE.muscles[side].SR,
    IR: SYSTEM_STATE.nerves[prefix+'CN3'] * SYSTEM_STATE.muscles[side].IR,
    IO: SYSTEM_STATE.nerves[prefix+'CN3'] * SYSTEM_STATE.muscles[side].IO,
    SO: SYSTEM_STATE.nerves[prefix+'CN4'] * SYSTEM_STATE.muscles[side].SO
  };

  // Basal tone drift [cite: 35, 36]
  const driftX = (1 - h.LR) * -0.4 + (1 - h.MR) * 0.4;
  const driftY = (1 - h.SR) * -0.1 + (1 - h.IR) * 0.1 + (h.SR === 0 && h.IR === 0 ? -0.25 : 0);

  // Responsiveness Boost for Rotation [cite: 37, 39, 42]
  let rotationYaw = isRight ? 
    (targetYaw < 0 ? targetYaw * h.LR * 1.5 : targetYaw * h.MR * 1.5) : 
    (targetYaw > 0 ? targetYaw * h.LR * 1.5 : targetYaw * h.MR * 1.5);

  // Anatomical Blending (0 = Temporal, 1 = Nasal) [cite: 40]
  const nasalYaw = isRight ? targetYaw : -targetYaw;
  const blend = 1 / (1 + Math.exp(-(nasalYaw + 0.15) * 7)); 

  // Physical Eye Rotation [cite: 42, 43]
  let rotationPitch;
  if (targetPitch > 0) { 
    rotationPitch = (targetPitch * 1.4) * ( (1 - blend) * h.SR + blend * h.IO );
  } else { 
    rotationPitch = (targetPitch * 2.8) * ( (1 - blend) * h.IR + blend * h.SO );
  }

  const finalYaw = rotationYaw + (isRight ? -driftX : driftX);
  const finalPitch = rotationPitch + driftY;

  // RAW EFFORT (Calculated WITHOUT the 2.8x boost to prevent bar saturation) [cite: 44, 45, 52]
  const effortY = Math.abs(targetPitch); 
  const abd = isRight ? -finalYaw : finalYaw;
  const add = -abd;

  return {
    rotation: { y: finalYaw, x: finalPitch },
    acts: {
      LR: (0.2 + Math.max(0, abd) * 1.8) * h.LR,
      MR: (0.2 + Math.max(0, add) * 1.8) * h.MR,
      SR: (0.2 + (targetPitch > 0 ? effortY : 0) * 2.2 * (1 - blend)) * h.SR,
      IR: (0.2 + (targetPitch < 0 ? effortY : 0) * 2.2 * (1 - blend)) * h.IR,
      IO: (0.2 + (targetPitch > 0 ? effortY : 0) * 2.0 * blend) * h.IO,
      SO: (0.2 + (targetPitch < 0 ? effortY : 0) * 2.0 * blend + (h.IR === 0 ? 0.3 : 0)) * h.SO
    }
  };
}
