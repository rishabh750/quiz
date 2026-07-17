package com.interviewprep.crypto;

import java.security.PrivateKey;
import java.security.spec.MGF1ParameterSpec;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import javax.crypto.spec.SecretKeySpec;

public final class RsaCrypto {

    private RsaCrypto() {
    }

    public static SecretKey unwrapAesKey(PrivateKey privateKey, String wrappedBase64) {
        try {
            Cipher cipher = Cipher.getInstance("RSA/ECB/OAEPPadding");
            OAEPParameterSpec spec = new OAEPParameterSpec(
                    "SHA-256", "MGF1", new MGF1ParameterSpec("SHA-256"), PSource.PSpecified.DEFAULT);
            cipher.init(Cipher.DECRYPT_MODE, privateKey, spec);
            byte[] keyBytes = cipher.doFinal(Base64.getDecoder().decode(wrappedBase64));
            return new SecretKeySpec(keyBytes, "AES");
        } catch (Exception e) {
            throw new IllegalArgumentException("Could not unwrap request key", e);
        }
    }
}
