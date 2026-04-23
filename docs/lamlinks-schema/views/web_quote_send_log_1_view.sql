-- dbo.web_quote_send_log_1_view



/* view web_quote_send_log_1_view: add view */


/* view web_quote_send_log_1_view: add view */


/* view web_quote_send_log_1_view: add view */

/* view web_quote_send_log_1_view: add view */


/* view web_quote_send_log_1_view: add view */


/* view web_quote_send_log_1_view: add view */


/* view web_quote_send_log_1_view: add view */


/* view web_quote_send_log_1_view: add view */


/* view web_quote_send_log_1_view: add view */


/* view web_quote_send_log_1_view: add view */
/* view web_quote_send_log_1_view: add view 
 view web_quote_send_log_1_view: add view 
 view web_quote_send_log_1_view: add view 
 view web_quote_send_log_1_view: add view 
 view web_quote_send_log_1_view: add view 
 view web_quote_send_log_1_view: add view 
 view web_quote_send_log_1_view: add view 
 view web_quote_send_log_1_view: add view */
CREATE VIEW [dbo].[web_quote_send_log_1_view]
AS
SELECT DISTINCT 
                         dbo.solicitation_line_1_view.sol_no_k10, dbo.solicitation_line_1_view.fsc_k08, dbo.solicitation_line_1_view.niin_k08, dbo.kd8_tab.q_time_kd8, dbo.demographics_1_view.d_code_ka7, 
                         dbo.demographics_1_view.d_name_ka7, dbo.kd8_tab.qtopoc_kd8, dbo.kd8_tab.orefno_kd8, dbo.kd8_tab.q_clas_kd8, dbo.kd8_tab.mfg_pn_kd8, dbo.kd8_tab.valday_kd8, dbo.solicitation_line_1_view.p_desc_k08, 
                         dbo.k14_tab.u_name_k14, dbo.k14_tab.idnk14_k14, dbo.solicitation_line_1_view.idnk08_k08, dbo.solicitation_line_1_view.idnk10_k10, dbo.kd8_tab.bidtyp_kd8, dbo.kd8_tab.fobcod_kd8, dbo.kd8_tab.insmat_kd8, 
                         dbo.kd8_tab.acc_sd_kd8, dbo.kd8_tab.idnkd8_kd8, dbo.kd8_tab.q_stat_kd8, dbo.solicitation_line_1_view.source_k09, dbo.demographics_1_view.idnk12_k12, dbo.kd8_tab.mfgk12_kd8, dbo.kd8_tab.ptrk12_kd8, 
                         dbo.kd8_tab.took12_kd8, dbo.kd8_tab.qtemal_kd8, dbo.demographics_1_view.gduset_ka7, dbo.solicitation_line_1_view.idnkc4_kc4, dbo.k34_tab.idnk34_k34, dbo.k06_tab.idnk06_k06, dbo.k06_tab.trmdes_k06, 
                         dbo.kd8_tab.qstext_kd8, dbo.kdh_tab.q_mode_kdh, dbo.kdh_tab.idnkdh_kdh
FROM            dbo.kd8_tab INNER JOIN
                         dbo.solicitation_line_1_view ON dbo.kd8_tab.idnkc4_kd8 = dbo.solicitation_line_1_view.idnkc4_kc4 INNER JOIN
                         dbo.k14_tab ON dbo.kd8_tab.idnk14_kd8 = dbo.k14_tab.idnk14_k14 INNER JOIN
                         dbo.demographics_1_view ON dbo.kd8_tab.took12_kd8 = dbo.demographics_1_view.idnk12_k12 INNER JOIN
                         dbo.k06_tab ON dbo.kd8_tab.idnk06_kd8 = dbo.k06_tab.idnk06_k06 INNER JOIN
                         dbo.kdh_tab ON dbo.demographics_1_view.idnk12_k12 = dbo.kdh_tab.idnk12_kdh LEFT OUTER JOIN
                         dbo.k34_tab ON dbo.kd8_tab.idnsrc_kd8 = dbo.k34_tab.idnk34_k34 AND dbo.kd8_tab.srctyp_kd8 = 'k34'
WHERE        (dbo.demographics_1_view.gduset_ka7 = 'Purchase From')










