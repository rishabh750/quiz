package com.interviewprep.crypto;

import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public final class AesGcm {

    private static final int IV_LEN = 12;
    private static final int TAG_BITS = 128;
    private static final SecureRandom RANDOM = new SecureRandom();

    private AesGcm() {
    }

    public static byte[] randomIv() {
        byte[] iv = new byte[IV_LEN];
        RANDOM.nextBytes(iv);
        return iv;
    }

    public static byte[] encrypt(SecretKey key, byte[] iv, byte[] plaintext) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            return cipher.doFinal(plaintext);
        } catch (Exception e) {
            throw new IllegalStateException("AES-GCM encryption failed", e);
        }
    }

    public static byte[] decrypt(SecretKey key, byte[] iv, byte[] ciphertext) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            return cipher.doFinal(ciphertext);
        } catch (Exception e) {
            throw new IllegalArgumentException("AES-GCM decryption failed", e);
        }
    }

    public static String encryptToBase64(SecretKey key, byte[] plaintext) {
        byte[] iv = randomIv();
        byte[] ct = encrypt(key, iv, plaintext);
        byte[] out = new byte[iv.length + ct.length];
        System.arraycopy(iv, 0, out, 0, iv.length);
        System.arraycopy(ct, 0, out, iv.length, ct.length);
        return Base64.getEncoder().encodeToString(out);
    }

    public static byte[] decryptFromBase64(SecretKey key, String data) {
        byte[] raw = Base64.getDecoder().decode(data);
        byte[] iv = new byte[IV_LEN];
        byte[] ct = new byte[raw.length - IV_LEN];
        System.arraycopy(raw, 0, iv, 0, IV_LEN);
        System.arraycopy(raw, IV_LEN, ct, 0, ct.length);
        return decrypt(key, iv, ct);
    }
}
