package com.interviewprep.crypto;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class AtRestConverter implements AttributeConverter<String, String> {

    private static final Logger log = LoggerFactory.getLogger(AtRestConverter.class);

    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null) {
            return null;
        }
        return AesGcm.encryptToBase64(AtRestKey.get(), attribute.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }
        try {
            byte[] plain = AesGcm.decryptFromBase64(AtRestKey.get(), dbData);
            return new String(plain, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.warn("Could not decrypt a stored value (wrong APP_ENCRYPTION_KEY or data from a "
                    + "different backend); treating it as empty. Re-save the record to fix.");
            return null;
        }
    }
}
