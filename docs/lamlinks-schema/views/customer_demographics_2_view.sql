-- dbo.customer_demographics_2_view



/* view customer_demographics_2_view: add view */


/* view customer_demographics_2_view: add view */


/* view customer_demographics_2_view: add view */

/* view customer_demographics_2_view: add view */


/* view customer_demographics_2_view: add view */


/* view customer_demographics_2_view: add view */


/* view customer_demographics_2_view: add view */


/* view customer_demographics_2_view: add view */


/* view customer_demographics_2_view: add view */


/* view customer_demographics_2_view: add view */
/* view customer_demographics_2_view: add view 
 view customer_demographics_2_view: add view */
CREATE VIEW [dbo].[customer_demographics_2_view]
AS
SELECT        dbo.ka6_tab.idnka6_ka6, dbo.ka6_tab.gdutbl_ka6, dbo.ka6_tab.idngdu_ka6, dbo.ka6_tab.frozen_ka6, dbo.customer_demographics_1_view.idnk31_k31, dbo.customer_demographics_1_view.uptime_k31, 
                         dbo.customer_demographics_1_view.upname_k31, dbo.customer_demographics_1_view.gduset_ka7, dbo.customer_demographics_1_view.a_code_k31, dbo.customer_demographics_1_view.c_code_k31, 
                         dbo.customer_demographics_1_view.c_name_k31, dbo.customer_demographics_1_view.idnk12_k12, dbo.customer_demographics_1_view.uptime_k12, dbo.customer_demographics_1_view.upname_k12, 
                         dbo.customer_demographics_1_view.e_code_k12, dbo.customer_demographics_1_view.e_name_k12, dbo.customer_demographics_1_view.e_fnam_k12, dbo.customer_demographics_1_view.e_phon_k12, 
                         dbo.customer_demographics_1_view.e_faxn_k12, dbo.customer_demographics_1_view.e_attn_k12, dbo.customer_demographics_1_view.e_emal_k12, dbo.customer_demographics_1_view.e_madr_k12, 
                         dbo.customer_demographics_1_view.e_note_k12, dbo.customer_demographics_1_view.idnka7_ka7, dbo.customer_demographics_1_view.uptime_ka7, dbo.customer_demographics_1_view.idnk12_ka7, 
                         dbo.customer_demographics_1_view.frozen_ka7, dbo.customer_demographics_1_view.d_code_ka7, dbo.customer_demographics_1_view.d_name_ka7, dbo.customer_demographics_1_view.d_nam2_ka7, 
                         dbo.customer_demographics_1_view.d_nam3_ka7, dbo.customer_demographics_1_view.d_adr1_ka7, dbo.customer_demographics_1_view.d_adr2_ka7, dbo.customer_demographics_1_view.d_adr3_ka7, 
                         dbo.customer_demographics_1_view.d_adr4_ka7, dbo.customer_demographics_1_view.d_city_ka7, dbo.customer_demographics_1_view.d_stte_ka7, dbo.customer_demographics_1_view.d_zipc_ka7, 
                         dbo.customer_demographics_1_view.d_cntr_ka7, dbo.customer_demographics_1_view.d_attn_ka7, dbo.customer_demographics_1_view.d_phon_ka7, dbo.customer_demographics_1_view.d_faxn_ka7, 
                         dbo.customer_demographics_1_view.d_emal_ka7, dbo.customer_demographics_1_view.d_cell_ka7, dbo.kah_tab.a_note_kah, dbo.kdw_tab.c_clas_kdw, dbo.kdw_tab.c_stat_kdw, dbo.kdw_tab.c_cntr_kdw, 
                         dbo.kdw_tab.fob_od_kdw, dbo.k06_tab.trmdes_k06, dbo.kdw_tab.idnkdw_kdw, dbo.kah_tab.idnkah_kah, dbo.kah_tab.idnanu_kah, dbo.kah_tab.anutbl_kah, dbo.k06_tab.idnk06_k06, dbo.kdw_tab.q_mode_kdw, 
                         dbo.kdw_tab.idnk06_kdw, dbo.customer_demographics_1_view.homurl_k12, dbo.customer_demographics_1_view.e_desc_k12
FROM            dbo.customer_demographics_1_view INNER JOIN
                         dbo.ka6_tab ON dbo.customer_demographics_1_view.idnka7_ka7 = dbo.ka6_tab.idnka7_ka6 INNER JOIN
                         dbo.kdw_tab ON dbo.customer_demographics_1_view.idnk31_k31 = dbo.kdw_tab.idnk31_kdw INNER JOIN
                         dbo.k06_tab ON dbo.kdw_tab.idnk06_kdw = dbo.k06_tab.idnk06_k06 LEFT OUTER JOIN
                         dbo.kah_tab ON dbo.customer_demographics_1_view.idnka7_ka7 = dbo.kah_tab.idnanu_kah










