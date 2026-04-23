-- dbo.aq_partner_1_view



/* view aq_partner_1_view: add view */


/* view aq_partner_1_view: add view */


/* view aq_partner_1_view: add view */

/* view aq_partner_1_view: add view */


/* view aq_partner_1_view: add view */


/* view aq_partner_1_view: add view */


/* view aq_partner_1_view: add view */


/* view aq_partner_1_view: add view */


/* view aq_partner_1_view: add view */


/* view aq_partner_1_view: add view */
/* view aq_partner_1_view: add view 
 view aq_partner_1_view: add view 
 view aq_partner_1_view: add view 
 view aq_partner_1_view: add view 
 view aq_partner_1_view: add view */
CREATE VIEW [dbo].[aq_partner_1_view]
AS
SELECT        dbo.entity_relationship_1_view.e_name_ptr, dbo.entity_relationship_1_view.d_name_too, dbo.kd9_tab.q_stat_kd9, dbo.kdh_tab.idnk06_kdh, dbo.kdw_tab.idnk06_kdw, dbo.kdh_tab.q_mode_kdh, 
                         dbo.kdw_tab.q_mode_kdw, dbo.entity_relationship_1_view.d_emal_too, dbo.entity_relationship_1_view.d_attn_too, dbo.entity_relationship_1_view.idnka7_too, dbo.kd9_tab.idnkd9_kd9, 
                         dbo.entity_relationship_1_view.idnka6_ka6, dbo.k06_tab.idnk06_k06, dbo.k06_tab.trmdes_k06, dbo.entity_relationship_1_view.gduset_ka7, dbo.entity_relationship_1_view.d_code_too, 
                         dbo.entity_relationship_1_view.e_code_ptr, dbo.entity_relationship_1_view.idnk12_ptr, dbo.kd9_tab.k12qto_kd9, dbo.kd9_tab.k12ptr_kd9, dbo.kdh_tab.idnkdh_kdh, dbo.kdh_tab.uptime_kdh, 
                         dbo.credential_control_2_view.c_stat_kdg, dbo.entity_relationship_1_view.idnk12_too, dbo.credential_control_2_view.idnkdg_kdg, dbo.kdw_tab.idnkdw_kdw
FROM            dbo.k31_tab INNER JOIN
                         dbo.kdw_tab ON dbo.k31_tab.idnk31_k31 = dbo.kdw_tab.idnk31_kdw INNER JOIN
                         dbo.kdh_tab INNER JOIN
                         dbo.k06_tab ON dbo.kdh_tab.idnk06_kdh = dbo.k06_tab.idnk06_k06 INNER JOIN
                         dbo.kd9_tab INNER JOIN
                         dbo.entity_relationship_1_view ON dbo.kd9_tab.k12qto_kd9 = dbo.entity_relationship_1_view.idnk12_too AND dbo.kd9_tab.k12ptr_kd9 = dbo.entity_relationship_1_view.idnk12_ptr ON 
                         dbo.kdh_tab.idnk12_kdh = dbo.kd9_tab.k12qto_kd9 ON dbo.kdh_tab.idnk12_kdh = dbo.k31_tab.idnk12_k31 LEFT OUTER JOIN
                         dbo.credential_control_2_view ON dbo.entity_relationship_1_view.idnka7_too = dbo.credential_control_2_view.idntoa_kdg










