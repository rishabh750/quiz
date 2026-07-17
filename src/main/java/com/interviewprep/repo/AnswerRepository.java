package com.interviewprep.repo;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.interviewprep.model.Answer;

public interface AnswerRepository extends JpaRepository<Answer, UUID> {
    List<Answer> findByCourseIdOrderByQuestionNumberAsc(UUID courseId);

    Answer findByCourseIdAndQuestionNumber(UUID courseId, int questionNumber);

    void deleteByCourseId(UUID courseId);

    void deleteByCourseIdAndQuestionNumberIn(UUID courseId, List<Integer> questionNumbers);
}
