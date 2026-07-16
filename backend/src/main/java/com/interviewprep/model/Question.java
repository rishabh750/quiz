package com.interviewprep.model;

import java.util.UUID;

import com.interviewprep.crypto.AtRestConverter;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "questions", uniqueConstraints = @UniqueConstraint(name = "uq_question_course_num", columnNames = {"course_id", "question_number"}))
public class Question {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @Column(nullable = false, length = 255)
    private String section = "main";

    @Column(name = "question_number", nullable = false)
    private int questionNumber;

    @Column(name = "qtype", nullable = false, length = 8)
    private String qtype = "mcq";

    @Convert(converter = AtRestConverter.class)
    @Column(nullable = false, columnDefinition = "text")
    private String question;

    @Convert(converter = AtRestConverter.class)
    @Column(columnDefinition = "text")
    private String option1;

    @Convert(converter = AtRestConverter.class)
    @Column(columnDefinition = "text")
    private String option2;

    @Convert(converter = AtRestConverter.class)
    @Column(columnDefinition = "text")
    private String option3;

    @Convert(converter = AtRestConverter.class)
    @Column(columnDefinition = "text")
    private String option4;

    @Column(name = "correct_option")
    private Integer correctOption;

    @Convert(converter = AtRestConverter.class)
    @Column(columnDefinition = "text")
    private String answer;

    public void setCourse(Course course) {
        this.course = course;
    }

    public String getSection() {
        return section;
    }

    public void setSection(String section) {
        this.section = section;
    }

    public int getQuestionNumber() {
        return questionNumber;
    }

    public void setQuestionNumber(int questionNumber) {
        this.questionNumber = questionNumber;
    }

    public String getQtype() {
        return qtype;
    }

    public void setQtype(String qtype) {
        this.qtype = qtype;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getOption1() {
        return option1;
    }

    public void setOption1(String option1) {
        this.option1 = option1;
    }

    public String getOption2() {
        return option2;
    }

    public void setOption2(String option2) {
        this.option2 = option2;
    }

    public String getOption3() {
        return option3;
    }

    public void setOption3(String option3) {
        this.option3 = option3;
    }

    public String getOption4() {
        return option4;
    }

    public void setOption4(String option4) {
        this.option4 = option4;
    }

    public Integer getCorrectOption() {
        return correctOption;
    }

    public void setCorrectOption(Integer correctOption) {
        this.correctOption = correctOption;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }
}
