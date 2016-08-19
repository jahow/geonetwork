/*
 * Copyright (C) 2001-2016 Food and Agriculture Organization of the
 * United Nations (FAO-UN), United Nations World Food Programme (WFP)
 * and United Nations Environment Programme (UNEP)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or (at
 * your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301, USA
 *
 * Contact: Jeroen Ticheler - FAO - Viale delle Terme di Caracalla 2,
 * Rome - Italy. email: geonetwork@osgeo.org
 */
package org.fao.geonet.api.records;

import com.google.common.collect.Lists;
import jeeves.server.context.ServiceContext;
import org.fao.geonet.api.ApiParams;
import org.fao.geonet.domain.Metadata;
import org.fao.geonet.domain.MetadataType;
import org.fao.geonet.kernel.DataManager;
import org.fao.geonet.kernel.SchemaManager;
import org.fao.geonet.kernel.UpdateDatestamp;
import org.fao.geonet.repository.MetadataRepository;
import org.fao.geonet.repository.SourceRepository;
import org.fao.geonet.services.AbstractServiceIntegrationTest;
import org.fao.geonet.utils.Xml;
import org.jdom.Element;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.*;

import static org.fao.geonet.kernel.mef.MEFLib.Version.Constants.MEF_V1_ACCEPT_TYPE;
import static org.fao.geonet.kernel.mef.MEFLib.Version.Constants.MEF_V2_ACCEPT_TYPE;
import static org.fao.geonet.schema.iso19139.ISO19139Namespaces.GCO;
import static org.fao.geonet.schema.iso19139.ISO19139Namespaces.GMD;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;


/**
 * Tests for class {@link MetadataApi}.
 *
 * @author juanluisrp
 **/
public class MetadataApiTest extends AbstractServiceIntegrationTest {
    @Autowired
    private WebApplicationContext wac;
    @Autowired
    private SchemaManager schemaManager;
    @Autowired
    private DataManager dataManager;
    @Autowired
    private SourceRepository sourceRepository;

    @Autowired private MetadataRepository metadataRepository;

    private String uuid;
    private int id;
    private Metadata md;


    @Before
    public void setUp() throws Exception {
        ServiceContext context = createServiceContext();
        createTestData();
    }

    private void createTestData() throws Exception {
        final ServiceContext serviceContext = createServiceContext();
        loginAsAdmin(serviceContext);

        final Element sampleMetadataXml = getSampleMetadataXml();
        this.uuid = UUID.randomUUID().toString();
        Xml.selectElement(sampleMetadataXml, "gmd:fileIdentifier/gco:CharacterString", Arrays.asList(GMD, GCO)).setText(this.uuid);

        String source = sourceRepository.findAll().get(0).getUuid();
        String schema = schemaManager.autodetectSchema(sampleMetadataXml);
        final Metadata metadata = new Metadata().setDataAndFixCR(sampleMetadataXml).setUuid(uuid);
        metadata.getDataInfo().setRoot(sampleMetadataXml.getQualifiedName()).setSchemaId(schema).setType(MetadataType.METADATA);
        metadata.getDataInfo().setPopularity(1000);
        metadata.getSourceInfo().setOwner(1).setSourceId(source);
        metadata.getHarvestInfo().setHarvested(false);

        this.id = dataManager.insertMetadata(serviceContext, metadata, sampleMetadataXml, false, false, false, UpdateDatestamp.NO,
            false, false).getId();

        dataManager.indexMetadata(Lists.newArrayList("" + this.id));
        this.md = metadataRepository.findOne(this.id);
    }


    @Test
    public void getNonExistentRecordRecord() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.webAppContextSetup(this.wac).build();
        MockHttpSession mockHttpSession = loginAsAnonymous();
        String nonExistentUuid = UUID.randomUUID().toString();

        List<String> contentTypeWithoutBodyList = Lists.newArrayList(
            MediaType.TEXT_HTML_VALUE,
            "application/pdf",
            "application/zip",
            MEF_V1_ACCEPT_TYPE,
            MEF_V2_ACCEPT_TYPE
        );

        mockMvc.perform(get("/api/records/" + nonExistentUuid)
            .session(mockHttpSession)
            .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNotFound())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.code").value(equalTo("resource_not_found")));

        mockMvc.perform(get("/api/records/" + nonExistentUuid)
            .session(mockHttpSession)
            .accept(MediaType.APPLICATION_XML))
            .andExpect(status().isNotFound())
            .andExpect(content().contentType(MediaType.APPLICATION_XML))
            .andExpect(xpath("/apiError/code").string("resource_not_found"));


        for (String contentTypeWithoutBody : contentTypeWithoutBodyList) {
            mockMvc.perform(get("/api/records/" + nonExistentUuid)
                .session(mockHttpSession)
                .accept(contentTypeWithoutBody))
                .andExpect(status().isNotFound())
                .andExpect(content().string(isEmptyOrNullString()));
        }
    }

    @Test
    public void getNonAllowedRecord() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.webAppContextSetup(this.wac).build();
        MockHttpSession mockHttpSession = loginAsAnonymous();

        List<String> contentTypeWithoutBodyList = Lists.newArrayList(
            MediaType.TEXT_HTML_VALUE,
            "application/pdf",
            "application/zip",
            MEF_V1_ACCEPT_TYPE,
            MEF_V2_ACCEPT_TYPE
        );


        mockMvc.perform(get("/api/records/" + this.uuid)
            .session(mockHttpSession)
            .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isForbidden())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.code").value(equalTo("forbidden")))
            .andExpect(jsonPath("$.message").value(equalTo(ApiParams.API_RESPONSE_NOT_ALLOWED_CAN_VIEW)));

        mockMvc.perform(get("/api/records/" + this.uuid)
            .session(mockHttpSession)
            .accept(MediaType.APPLICATION_XML))
            .andExpect(status().isForbidden())
            .andExpect(content().contentType(MediaType.APPLICATION_XML))
            .andExpect(xpath("/apiError/code").string(equalTo("forbidden")))
            .andExpect(xpath("/apiError/message").string(equalTo(ApiParams.API_RESPONSE_NOT_ALLOWED_CAN_VIEW)));

        mockMvc.perform(get("/api/records/" + this.uuid)
            .session(mockHttpSession)
            .accept(MediaType.APPLICATION_XHTML_XML_VALUE))
            .andExpect(status().isForbidden())
            .andExpect(content().contentType(MediaType.APPLICATION_XHTML_XML_VALUE))
            .andExpect(xpath("/apiError/code").string(equalTo("forbidden")))
            .andExpect(xpath("/apiError/message").string(equalTo(ApiParams.API_RESPONSE_NOT_ALLOWED_CAN_VIEW)));


        for (String contentTypeWihoutBody : contentTypeWithoutBodyList) {
            mockMvc.perform(get("/api/records/" + this.uuid)
                .session(mockHttpSession)
                .accept(contentTypeWihoutBody))
                .andExpect(status().isForbidden())
                .andExpect(content().string(isEmptyOrNullString()));
        }
    }

    @Test
    public void getRecord() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.webAppContextSetup(this.wac).build();
        MockHttpSession mockHttpSession = loginAsAdmin();

        Map<String, String> contentTypes = new LinkedHashMap<>();
        contentTypes.put(MediaType.TEXT_HTML_VALUE, this.uuid + "/formatters/xsl-view");
        contentTypes.put(MediaType.APPLICATION_XHTML_XML_VALUE, this.uuid + "/formatters/xsl-view");
        contentTypes.put("application/pdf", this.uuid + "/formatters/xsl-view");
        contentTypes.put(MediaType.APPLICATION_XML_VALUE, this.uuid + "/formatters/xml");
        contentTypes.put(MediaType.APPLICATION_JSON_VALUE, this.uuid + "/formatters/xml");
        contentTypes.put("application/zip", this.uuid + "/formatters/zip");
        contentTypes.put(MEF_V1_ACCEPT_TYPE, this.uuid + "/formatters/zip");
        contentTypes.put(MEF_V2_ACCEPT_TYPE, this.uuid + "/formatters/zip");

        for(Map.Entry<String, String> entry : contentTypes.entrySet()) {
            mockMvc.perform(get("/api/records/" + this.uuid)
                .session(mockHttpSession)
                .accept(entry.getKey()))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(forwardedUrl(entry.getValue()));
        }
    }

    @Test
    public void getRecordAsXML() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.webAppContextSetup(this.wac).build();
        MockHttpSession mockHttpSession = loginAsAdmin();

        mockMvc.perform(get("/api/records/" + this.uuid + "/formatters/xml")
            .session(mockHttpSession)
            .accept(MediaType.APPLICATION_XML))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_XML))
            .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                equalTo(String.format("inline; filename=\"%s.%s\"", this.uuid, "xml"))))
            .andExpect(content().string(containsString(this.uuid)))
            .andExpect(xpath("/MD_Metadata/fileIdentifier/CharacterString").string(this.uuid));

        mockMvc.perform(get("/api/records/" + this.uuid + "/formatters/json")
            .session(mockHttpSession)
            .accept(MediaType.APPLICATION_JSON))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
            .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                equalTo(String.format("inline; filename=\"%s.%s\"", this.uuid, "json"))))
            .andExpect(content().string(containsString(this.uuid)))
            .andExpect(jsonPath("$.['gmd:fileIdentifier'].['gco:CharacterString'].['#text']").value(this.uuid));
    }

    @Test
    public void getRecordAsXMLAddSchemaLocation() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.webAppContextSetup(this.wac).build();
        MockHttpSession mockHttpSession = loginAsAdmin();

        // Add Schema locations
        mockMvc.perform(get("/api/records/" + this.uuid + "/formatters/xml").param("addSchemaLocation", "true")
            .session(mockHttpSession)
            .accept(MediaType.APPLICATION_XML))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_XML))
            .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                equalTo(String.format("inline; filename=\"%s.%s\"", this.uuid, "xml"))))
            .andExpect(content().string(containsString(this.uuid)))
            .andExpect(content().string(containsString(".xsd")))
            .andExpect(xpath("/MD_Metadata/fileIdentifier/CharacterString").string(this.uuid));

        mockMvc.perform(get("/api/records/" + this.uuid + "/formatters/xml").param("addSchemaLocation", "false")
            .session(mockHttpSession)
            .accept(MediaType.APPLICATION_XML))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_XML))
            .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                equalTo(String.format("inline; filename=\"%s.%s\"", this.uuid, "xml"))))
            .andExpect(content().string(containsString(this.uuid)))
            .andExpect(content().string(not(containsString(".xsd"))))
            .andExpect(xpath("/MD_Metadata/fileIdentifier/CharacterString").string(this.uuid));
    }

    @Test
    public void getRecordAsXMLIncreasePopularity() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.webAppContextSetup(this.wac).build();
        MockHttpSession mockHttpSession = loginAsAdmin();
        int popularity = md.getDataInfo().getPopularity();

        // Add Schema locations
        mockMvc.perform(get("/api/records/" + this.uuid + "/formatters/xml").param("increasePopularity", "true")
            .session(mockHttpSession)
            .accept(MediaType.APPLICATION_XML))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_XML))
            .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                equalTo(String.format("inline; filename=\"%s.%s\"", this.uuid, "xml"))))
            .andExpect(content().string(containsString(this.uuid)))
            .andExpect(xpath("/MD_Metadata/fileIdentifier/CharacterString").string(this.uuid));
        int newPopularity = metadataRepository.findOneByUuid(this.uuid).getDataInfo().getPopularity();
        Assert.assertThat("Popularity has not been incremented by one", newPopularity, equalTo(popularity + 1));

        popularity = newPopularity;


        mockMvc.perform(get("/api/records/" + this.uuid + "/formatters/xml").param("increasePopularity", "false")
            .session(mockHttpSession)
            .accept(MediaType.APPLICATION_XML))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_XML))
            .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                equalTo(String.format("inline; filename=\"%s.%s\"", this.uuid, "xml"))))
            .andExpect(content().string(containsString(this.uuid)))
            .andExpect(xpath("/MD_Metadata/fileIdentifier/CharacterString").string(this.uuid));
        newPopularity = metadataRepository.findOneByUuid(this.uuid).getDataInfo().getPopularity();
        Assert.assertThat("Popularity has changed", newPopularity, equalTo(popularity));
    }

    @Test
    public void getNonAllowedRecordAsXml() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.webAppContextSetup(this.wac).build();
        MockHttpSession mockHttpSession = loginAsAnonymous();

        mockMvc.perform(get("/api/records/" + this.uuid + "/formatters/json")
            .session(mockHttpSession)
            .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isForbidden())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.code").value(equalTo("forbidden")))
            .andExpect(jsonPath("$.message").value(equalTo(ApiParams.API_RESPONSE_NOT_ALLOWED_CAN_VIEW)));

        mockMvc.perform(get("/api/records/" + this.uuid + "/formatters/xml")
            .session(mockHttpSession)
            .accept(MediaType.APPLICATION_XML))
            .andExpect(status().isForbidden())
            .andExpect(content().contentType(MediaType.APPLICATION_XML))
            .andExpect(xpath("/apiError/code").string(equalTo("forbidden")))
            .andExpect(xpath("/apiError/message").string(equalTo(ApiParams.API_RESPONSE_NOT_ALLOWED_CAN_VIEW)));
    }

    @Test
    public void getNonExistentRecordAsXml() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.webAppContextSetup(this.wac).build();
        MockHttpSession mockHttpSession = loginAsAnonymous();
        String nonExistentUuid = UUID.randomUUID().toString();

        mockMvc.perform(get("/api/records/" + nonExistentUuid + "/formatters/json")
            .session(mockHttpSession)
            .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNotFound())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.code").value(equalTo("resource_not_found")));

        mockMvc.perform(get("/api/records/" + nonExistentUuid + "/formatters/xml")
            .session(mockHttpSession)
            .accept(MediaType.APPLICATION_XML))
            .andExpect(status().isNotFound())
            .andExpect(content().contentType(MediaType.APPLICATION_XML))
            .andExpect(xpath("/apiError/code").string("resource_not_found"));
    }

    @Test
    public void getRecordAsZip() throws Exception {

        final String zipMagicNumber = "PK\u0003\u0004";

        MockMvc mockMvc = MockMvcBuilders.webAppContextSetup(this.wac).build();
        MockHttpSession mockHttpSession = loginAsAdmin();

        mockMvc.perform(get("/api/records/" + this.uuid + "/formatters/zip")
            .session(mockHttpSession)
            .accept("application/zip"))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/zip"))
            .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                equalTo(String.format("inline; filename=\"%s.%s\"", this.uuid, "zip"))))
            .andExpect(content().string(startsWith(zipMagicNumber)));

        mockMvc.perform(get("/api/records/" + this.uuid + "/formatters/zip")
            .session(mockHttpSession)
            .accept(MEF_V1_ACCEPT_TYPE))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(content().contentType(MEF_V1_ACCEPT_TYPE))
            .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                equalTo(String.format("inline; filename=\"%s.%s\"", this.uuid, "zip"))))
            .andExpect(content().string(startsWith(zipMagicNumber)));

        mockMvc.perform(get("/api/records/" + this.uuid + "/formatters/zip")
            .session(mockHttpSession)
            .accept(MEF_V1_ACCEPT_TYPE))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(content().contentType(MEF_V1_ACCEPT_TYPE))
            .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                equalTo(String.format("inline; filename=\"%s.%s\"", this.uuid, "zip"))))
            .andExpect(content().string(startsWith(zipMagicNumber)));

    }

    @Test
    public void getNonAllowedRecordAsZip() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.webAppContextSetup(this.wac).build();
        MockHttpSession mockHttpSession = loginAsAnonymous();

        mockMvc.perform(get("/api/records/" + this.uuid + "/formatters/zip")
            .session(mockHttpSession)
            .accept("application/zip"))
            .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/records/" + this.uuid + "/formatters/zip")
            .session(mockHttpSession)
            .accept(MEF_V1_ACCEPT_TYPE))
            .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/records/" + this.uuid + "/formatters/zip")
            .session(mockHttpSession)
            .accept(MEF_V2_ACCEPT_TYPE))
            .andExpect(status().isForbidden());
    }

    @Test
    public void getNonExistentRecordAsZip() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.webAppContextSetup(this.wac).build();
        MockHttpSession mockHttpSession = loginAsAnonymous();
        String nonExistentUuid = UUID.randomUUID().toString();

        mockMvc.perform(get("/api/records/" + nonExistentUuid + "/formatters/zip")
            .session(mockHttpSession)
            .accept("application/zip"))
            .andExpect(status().isNotFound())
            .andExpect(header().doesNotExist(HttpHeaders.CONTENT_TYPE))
            .andExpect(content().string(isEmptyOrNullString()));

        mockMvc.perform(get("/api/records/" + nonExistentUuid + "/formatters/zip")
            .session(mockHttpSession)
            .accept(MEF_V1_ACCEPT_TYPE))
            .andExpect(status().isNotFound())
            .andExpect(header().doesNotExist(HttpHeaders.CONTENT_TYPE))
            .andExpect(content().string(isEmptyOrNullString()));

        mockMvc.perform(get("/api/records/" + nonExistentUuid + "/formatters/zip")
            .session(mockHttpSession)
            .accept(MEF_V2_ACCEPT_TYPE))
            .andExpect(status().isNotFound())
            .andExpect(header().doesNotExist(HttpHeaders.CONTENT_TYPE))
            .andExpect(content().string(isEmptyOrNullString()));
    }


    @Test
    public void getRelatedNonExistent() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.webAppContextSetup(this.wac).build();
        MockHttpSession mockHttpSession = loginAsAnonymous();
        String nonExistentUuid = UUID.randomUUID().toString();

        mockMvc.perform(get("/api/records/" + nonExistentUuid + "/related")
            .session(mockHttpSession)
            .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNotFound())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.code").value(equalTo("resource_not_found")));

        mockMvc.perform(get("/api/records/" + nonExistentUuid + "/related")
            .session(mockHttpSession)
            .accept(MediaType.APPLICATION_XML))
            .andExpect(status().isNotFound())
            .andExpect(content().contentType(MediaType.APPLICATION_XML))
            .andExpect(xpath("/apiError/code").string("resource_not_found"));

    }

    @Test
    public void getRelatedNonAllowed() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.webAppContextSetup(this.wac).build();
        MockHttpSession mockHttpSession = loginAsAnonymous();

        mockMvc.perform(get("/api/records/" + this.uuid + "/related")
            .session(mockHttpSession)
            .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isForbidden())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.code").value(equalTo("forbidden")))
            .andExpect(jsonPath("$.message").value(equalTo(ApiParams.API_RESPONSE_NOT_ALLOWED_CAN_VIEW)));

        mockMvc.perform(get("/api/records/" + this.uuid + "/related")
            .session(mockHttpSession)
            .accept(MediaType.APPLICATION_XML))
            .andExpect(status().isForbidden())
            .andExpect(content().contentType(MediaType.APPLICATION_XML))
            .andExpect(xpath("/apiError/code").string(equalTo("forbidden")))
            .andExpect(xpath("/apiError/message").string(equalTo(ApiParams.API_RESPONSE_NOT_ALLOWED_CAN_VIEW)));
    }

    @Test
    public void getRelated() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.webAppContextSetup(this.wac).build();
        MockHttpSession mockHttpSession = loginAsAdmin();


        mockMvc.perform(get("/api/records/" + this.uuid + "/related")
            .session(mockHttpSession)
            .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$").value(hasKey("onlines")));

        mockMvc.perform(get("/api/records/" + this.uuid + "/related")
            .session(mockHttpSession)
            .accept(MediaType.APPLICATION_XML))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_XML))
            .andExpect(xpath("/related/onlines").exists());

        // TODO test others getRelated parameters.

    }



}
